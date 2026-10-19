import { withCaptureLock } from "@/lib/callReview/consent";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { requireReviewOperator } from "@/lib/callReview/service";
import { runOperatorConsentEffect } from "@/lib/callControl/service";
import { recordWithdrawal } from "@/lib/callReview/withdrawal";

const references = { disclosureRef: z.string().trim().min(1).max(200), evidenceRef: z.string().trim().min(1).max(200), jurisdictionBasis: z.string().trim().min(1).max(100), eventKey: z.string().uuid() };
const Input = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("grant"), ...references }),
  z.strictObject({ action: z.literal("refuse"), ...references }),
  z.strictObject({ action: z.literal("withdraw"), eventKey: references.eventKey, disclosureRef: z.string().trim().max(200).default(""), evidenceRef: z.string().trim().max(200).default(""), jurisdictionBasis: z.string().trim().max(100).default(""), withdrawalSourceTime: z.unknown().optional() }),
]);
// This route records a response the operator witnessed on the call itself, so
// the source channel is fixed server-side; other channels get their own path.
const SOURCE_CHANNEL = "call";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  let withdrawalRequested = false;
  try {
    const operator = await requireReviewOperator();
    if (!db) return Response.json({ ok: false }, { status: 503 });
    const input = Input.safeParse(await req.json().catch(() => null));
    if (!input.success) return Response.json({ ok: false, error: "invalid_consent_event" }, { status: 422 });
    const capture = await db.callCaptureSession.findUnique({ where: { id: (await context.params).id } });
    if (!capture) return Response.json({ ok: false }, { status: 404 });
    const value = input.data;
    if (value.action === "withdraw") {
      withdrawalRequested = true;
      const { event, conflict } = await recordWithdrawal(capture, operator.user.id, value);
      const recorded = { id: event.id, action: event.action, occurredAt: event.occurred_at, recordedAt: event.recorded_at, sourceOccurredAt: event.source_occurred_at, sourceTimeStatus: event.source_time_status, reviewRequired: true };
      try { await runOperatorConsentEffect({ captureId: capture.id, action: "withdraw" }); }
      catch { return Response.json({ ok: false, error: "consent_effect_incomplete", data: recorded }, { status: 409 }); }
      return Response.json({ ok: !conflict, ...(conflict ? { error: "idempotency_conflict" } : {}), data: recorded }, { status: conflict ? 409 : 200 });
    }
    const data = await withCaptureLock(capture.account_id, capture.provider_call_id, async (client) => {
      const key = `${capture.id}:${value.eventKey}`;
      const existing = await client.callConsentEvent.findUnique({ where: { event_key: key } });
      if (existing) return existing;
      const current = await client.callCaptureSession.findUnique({ where: { id: capture.id } });
      if (!current) throw new Error("capture_not_found");
      if (current.withdrawal_received_at) throw new Error("withdrawal_is_terminal");
      if (value.action === "grant" && (current.control_state !== "CONSENT_PENDING_OPERATOR" || current.dtmf_decision !== "affirmative")) throw new Error("affirmative_dtmf_required");
      if (value.action === "refuse" && (current.control_state !== "CONSENT_PENDING_OPERATOR" || current.dtmf_decision !== "refused")) throw new Error("refusal_dtmf_required");
      const recordedAt = new Date();
      const event = await client.callConsentEvent.upsert({
        where: { event_key: key }, update: {},
        create: { account_id: capture.account_id, provider_call_id: capture.provider_call_id, event_key: key, action: value.action, artifact: "transcript", disclosure_ref: value.disclosureRef, evidence_ref: value.evidenceRef, jurisdiction_basis: value.jurisdictionBasis, source_channel: SOURCE_CHANNEL, actor_user_id: operator.user.id, occurred_at: recordedAt, recorded_at: recordedAt },
      });
      const state = value.action === "grant" ? "START_PENDING" : value.action === "refuse" ? "REFUSED" : "STOP_PENDING";
      await client.callCaptureSession.update({ where: { id: capture.id }, data: {
        control_state: state,
        ...(value.action === "grant" ? {} : { content_admission_closed_at: event.occurred_at }),
      } });
      return event;
    });
    if (data.action !== value.action || data.disclosure_ref !== value.disclosureRef || data.evidence_ref !== value.evidenceRef || data.jurisdiction_basis !== value.jurisdictionBasis) return Response.json({ ok: false, error: "idempotency_conflict" }, { status: 409 });
    const recorded = { id: data.id, action: data.action, occurredAt: data.occurred_at };
    try {
      await runOperatorConsentEffect({ captureId: capture.id, action: value.action });
    } catch {
      // The event and control state are already committed; retrying with the
      // same eventKey reaches the idempotent branch and re-drives the effect.
      return Response.json({ ok: false, error: "consent_effect_incomplete", data: recorded }, { status: 409 });
    }
    return Response.json({ ok: true, data: recorded });
  } catch (error) {
    const denied = error instanceof Error && error.message === "operator_required";
    return Response.json({ ok: false, error: denied ? "operator_required" : withdrawalRequested ? "withdrawal_recording_incomplete" : "consent_not_recorded" }, { status: denied ? 403 : 503 });
  }
}
