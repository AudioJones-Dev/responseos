import { db } from "@/lib/db/client";
import { requireReviewOperator } from "@/lib/callReview/service";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireReviewOperator();
    if (!db) return Response.json({ ok: false }, { status: 503 });
    const session = await db.grokCallSession.findUnique({ where: { capture_id: (await context.params).id }, select: {
      id: true, account_id: true, capture_id: true, generation: true, provider_call_id: true, xai_call_id: true,
      stopped_at: true, stop_reason: true, lease_expires_at: true,
      commands: { select: { id: true, kind: true, status: true, consumed_at: true, result_at: true } },
    } });
    return Response.json({ ok: true, data: { session, disconnectionConfirmed: false, terminalEvidence: "unqualified" } }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ ok: false, error: "operator_required" }, { status: 403 }); }
}
