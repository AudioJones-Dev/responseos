import { withCaptureLock } from "@/lib/callReview/consent";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { requireReviewOperator } from "@/lib/callReview/service";

const Input = z.strictObject({
  action: z.enum(["grant", "refuse", "withdraw"]),
  disclosureRef: z.string().trim().min(1).max(200),
  evidenceRef: z.string().trim().min(1).max(200),
  eventKey: z.string().uuid(),
});

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
      create: { account_id: capture.account_id, provider_call_id: capture.provider_call_id, event_key: `${capture.id}:${value.eventKey}`, action: value.action, artifact: "transcript", disclosure_ref: value.disclosureRef, evidence_ref: value.evidenceRef, actor_user_id: operator.user.id },
    }));
    if (data.action !== value.action || data.disclosure_ref !== value.disclosureRef || data.evidence_ref !== value.evidenceRef) return Response.json({ ok: false, error: "idempotency_conflict" }, { status: 409 });
    return Response.json({ ok: true, data: { id: data.id, action: data.action, occurredAt: data.occurred_at } });
  } catch {
    return Response.json({ ok: false, error: "consent_not_recorded" }, { status: 403 });
  }
}
