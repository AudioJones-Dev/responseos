import { withCaptureLock } from "@/lib/callReview/consent";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { requireReviewOperator } from "@/lib/callReview/service";

const Input = z.strictObject({
  action: z.enum(["grant", "refuse", "withdraw"]),
  disclosureRef: z.string().trim().min(1).max(200),
  evidenceRef: z.string().trim().min(1).max(200),
  jurisdictionBasis: z.string().trim().min(1).max(100),
  eventKey: z.string().uuid(),
});

// This route records a response the operator witnessed on the call itself, so
// the source channel is fixed server-side; other channels get their own path.
const SOURCE_CHANNEL = "call";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const operator = await requireReviewOperator();
    if (!db) return Response.json({ ok: false }, { status: 503 });
    const input = Input.safeParse(await req.json().catch(() => null));
    if (!input.success) return Response.json({ ok: false, error: "invalid_consent_event" }, { status: 422 });
    const capture = await db.callCaptureSession.findUnique({ where: { id: (await context.params).id } });
    if (!capture) return Response.json({ ok: false }, { status: 404 });
    const value = input.data;
    const data = await withCaptureLock(capture.account_id, capture.provider_call_id, (client) => client.callConsentEvent.upsert({
      where: { event_key: `${capture.id}:${value.eventKey}` }, update: {},
      create: { account_id: capture.account_id, provider_call_id: capture.provider_call_id, event_key: `${capture.id}:${value.eventKey}`, action: value.action, artifact: "transcript", disclosure_ref: value.disclosureRef, evidence_ref: value.evidenceRef, jurisdiction_basis: value.jurisdictionBasis, source_channel: SOURCE_CHANNEL, actor_user_id: operator.user.id, occurred_at: new Date() },
    }));
    if (data.action !== value.action || data.disclosure_ref !== value.disclosureRef || data.evidence_ref !== value.evidenceRef || data.jurisdiction_basis !== value.jurisdictionBasis) return Response.json({ ok: false, error: "idempotency_conflict" }, { status: 409 });
    return Response.json({ ok: true, data: { id: data.id, action: data.action, occurredAt: data.occurred_at } });
  } catch (error) {
    const denied = error instanceof Error && error.message === "operator_required";
    return Response.json({ ok: false, error: denied ? "operator_required" : "consent_not_recorded" }, { status: denied ? 403 : 503 });
  }
}
