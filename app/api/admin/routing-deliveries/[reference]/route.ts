import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { withTenantScope } from "@/lib/data/session-helpers";
import { deliveryStatus, reconcileSimulatedDelivery } from "@/lib/routing/ledger";
import { z } from "zod";
const accountIdParam = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/).optional();
// Operators carry no account on their session, so they name the tenant with ?accountId=; tenant users stay pinned to their own account.
async function scopedAccountId(request: Request) {
  const supplied = accountIdParam.safeParse(new URL(request.url).searchParams.get("accountId") ?? undefined);
  if (!supplied.success) return null;
  const scope = await withTenantScope(supplied.data);
  return scope.ok ? scope.effectiveAccountId ?? null : null;
}
export async function GET(request: Request, context: {params: Promise<{reference: string}>}) {
  await requireRole(["aj_admin", "operator", "client_admin", "client_viewer"]);
  if (!db) return Response.json({ok: false}, {status: 503});
  const accountId = await scopedAccountId(request);
  if (!accountId) return Response.json({ok: false, code: "tenant_scope_required"}, {status: 400});
  const {reference} = await context.params;
  const status = await deliveryStatus(db, accountId, reference);
  return Response.json(status ? {ok: true, ...status} : {ok: false}, {status: status ? 200 : 404, headers: {"Cache-Control": "no-store"}});
}
export async function POST(request: Request, context: {params: Promise<{reference: string}>}) {
  const session = await requireRole(["aj_admin", "operator"]);
  if (!db) return Response.json({ok: false}, {status: 503});
  const accountId = await scopedAccountId(request);
  if (!accountId) return Response.json({ok: false, code: "tenant_scope_required"}, {status: 400});
  if (Number(request.headers.get("content-length")) > 1024) return Response.json({ok: false}, {status: 413});
  let raw: string;
  try { raw = await request.text(); } catch { return Response.json({ok: false}, {status: 400}); }
  if (Buffer.byteLength(raw) > 1024) return Response.json({ok: false}, {status: 413});
  try {
    const input = z.object({decision: z.enum(["accepted", "not_accepted"]), evidenceReference: z.string().regex(/^[a-zA-Z0-9_.:-]{1,120}$/)}).strict().parse(JSON.parse(raw));
    const {reference} = await context.params;
    const status = await reconcileSimulatedDelivery(db, accountId, reference, session.user.id, input.decision, input.evidenceReference);
    return Response.json({ok: true, status, mode: "simulated"}, {headers: {"Cache-Control": "no-store"}});
  } catch { return Response.json({ok: false, code: "reconciliation_refused"}, {status: 409}); }
}
