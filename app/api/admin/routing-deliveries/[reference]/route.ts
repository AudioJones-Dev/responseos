import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { deliveryStatus, reconcileSimulatedDelivery } from "@/lib/routing/ledger";
import { z } from "zod";
export async function GET(_request: Request, context: {params: Promise<{reference: string}>}) {
  const session = await requireRole(["aj_admin", "operator", "client_admin", "client_viewer"]);
  if (!session.account?.id || !db) return Response.json({ok: false}, {status: 503});
  const {reference} = await context.params;
  const status = await deliveryStatus(db, session.account.id, reference);
  return Response.json(status ? {ok: true, ...status} : {ok: false}, {status: status ? 200 : 404, headers: {"Cache-Control": "no-store"}});
}
export async function POST(request: Request, context: {params: Promise<{reference: string}>}) {
  const session = await requireRole(["aj_admin", "operator"]);
  if (!session.account?.id || !db) return Response.json({ok: false}, {status: 503});
  if (Number(request.headers.get("content-length")) > 1024) return Response.json({ok: false}, {status: 413});
  let raw: string;
  try { raw = await request.text(); } catch { return Response.json({ok: false}, {status: 400}); }
  if (Buffer.byteLength(raw) > 1024) return Response.json({ok: false}, {status: 413});
  try {
    const input = z.object({decision: z.enum(["accepted", "not_accepted"]), evidenceReference: z.string().regex(/^[a-zA-Z0-9_.:-]{1,120}$/)}).strict().parse(JSON.parse(raw));
    const {reference} = await context.params;
    const status = await reconcileSimulatedDelivery(db, session.account.id, reference, session.user.id, input.decision, input.evidenceReference);
    return Response.json({ok: true, status, mode: "simulated"}, {headers: {"Cache-Control": "no-store"}});
  } catch { return Response.json({ok: false, code: "reconciliation_refused"}, {status: 409}); }
}
