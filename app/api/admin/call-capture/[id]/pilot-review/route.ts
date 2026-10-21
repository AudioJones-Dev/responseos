import { db } from "@/lib/db/client";
import { requireReviewOperator } from "@/lib/callReview/service";
import { draftGrokPilotReview } from "@/lib/grok/pilotReview";

async function operator() {
  try { await requireReviewOperator(); return true; } catch { return false; }
}

/** Live consented transcript for one pilot capture (ADR-0082). */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await operator()) return Response.json({ ok: false, error: "operator_required" }, { status: 403 });
  if (!db) return Response.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  const id = (await context.params).id;
  const capture = await db.callCaptureSession.findUnique({ where: { id }, select: { account_id: true, admission_mode: true } });
  if (!capture || capture.admission_mode !== "pilot") return Response.json({ ok: false, error: "not_pilot" }, { status: 404 });
  const session = await db.grokCallSession.findUnique({ where: { capture_id: id }, select: { id: true, stopped_at: true } });
  const turns = session ? await db.grokTranscriptTurn.findMany({ where: { session_id: session.id, account_id: capture.account_id }, orderBy: { sequence: "asc" }, select: { sequence: true, speaker: true, text: true, occurred_at: true } }) : [];
  return Response.json({ ok: true, data: { stopped: Boolean(session?.stopped_at), turns } }, { headers: { "Cache-Control": "no-store" } });
}

/** Drafts (or re-drafts) the review from the frozen transcript once the call has ended. */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await operator()) return Response.json({ ok: false, error: "operator_required" }, { status: 403 });
  try {
    const status = await draftGrokPilotReview((await context.params).id);
    return Response.json({ ok: status === "queued", data: { status } }, { status: status === "queued" ? 200 : 409 });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "draft_failed" }, { status: 409 });
  }
}
