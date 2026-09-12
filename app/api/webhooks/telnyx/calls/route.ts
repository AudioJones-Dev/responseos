import { after, NextResponse } from "next/server";
import { runCrmSyncForCall } from "@/lib/crm/syncFinalizedCall";
import {
  getWebhookProcessingState,
  recordWebhookEvent,
  setWebhookProcessStatus,
} from "@/lib/data/webhookEvents";
import { errorResponse } from "@/lib/providers/webhook-helpers";
import { normalizeTelnyxEvent } from "@/lib/providers/telnyx/normalize";
import {
  resolveTelnyxEventAssignment,
} from "@/lib/prospectBootstrap/service";
import { PROSPECT_CONTENT_RETENTION_DAYS } from "@/lib/prospectBootstrap/contracts";
import {
  getTelnyxAgentTarget,
  getTelnyxOccurredAt,
  parseTelnyxWebhook,
  verifyTelnyxWebhook,
} from "@/lib/providers/telnyx/webhook";

export async function POST(req: Request) {
  const publicKey = process.env.TELNYX_PUBLIC_KEY;
  if (
    process.env.RESPONSEOS_LIVE_TELNYX_INGEST_ENABLED !== "true" ||
    !publicKey
  ) {
    return errorResponse(503, {
      code: "telnyx_ingest_disabled",
      message: "Telnyx call ingestion is disabled or unavailable.",
    });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("telnyx-signature-ed25519");
  const timestamp = req.headers.get("telnyx-timestamp");
  const verified = verifyTelnyxWebhook({ rawBody, signature, timestamp, publicKey });
  if (!verified.ok) {
    return errorResponse(401, {
      code: `telnyx_signature_${verified.reason}`,
      message: "Telnyx webhook signature is invalid or stale.",
    });
  }

  const event = parseTelnyxWebhook(rawBody);
  if (!event) {
    return errorResponse(422, {
      code: "invalid_telnyx_event",
      message: "Telnyx webhook payload is invalid.",
    });
  }

  const target = getTelnyxAgentTarget(event.data.payload);
  const occurredAt = getTelnyxOccurredAt(event);
  const receivedAt = new Date();
  let resolved = process.env.RESPONSEOS_PROSPECT_BOOTSTRAP_ENABLED === "true" && target && occurredAt
    ? await resolveTelnyxEventAssignment({ target, occurredAt, receivedAt })
    : null;
  let personalized = true;
  const legacyAccountId = process.env.RESPONSEOS_DEMO_ACCOUNT_ID;
  const legacyNumber = process.env.RESPONSEOS_DEMO_PHONE_E164;
  if (
    !resolved &&
    target &&
    legacyAccountId &&
    legacyNumber &&
    target.replace(/\D/g, "") === legacyNumber.replace(/\D/g, "")
  ) {
    resolved = {
      accountId: legacyAccountId,
      bootstrapId: "legacy-evergreen-demo",
      assignmentId: "legacy-evergreen-demo",
      demoNumber: legacyNumber,
    };
    personalized = false;
  }

  const ledger = await recordWebhookEvent({
    account_id: resolved?.accountId,
    provider: "telnyx",
    provider_event_id: event.data.id,
    event_type: event.data.event_type,
    raw_body: rawBody,
    signature_header: signature ?? undefined,
    signature_valid: true,
    ...(personalized || !resolved
      ? { payload_expires_at: new Date((occurredAt ?? receivedAt).getTime() + PROSPECT_CONTENT_RETENTION_DAYS * 24 * 60 * 60 * 1000) }
      : {}),
  });
  if (!ledger.ok) {
    return errorResponse(503, {
      code: "webhook_ledger_unavailable",
      message: "Telnyx webhook ledger is unavailable.",
    });
  }
  if (!target || !occurredAt || !resolved) {
    await setWebhookProcessStatus({
      id: ledger.data.id,
      process_status: "rejected",
      process_error: !target
        ? "missing_destination"
        : !occurredAt
          ? "missing_occurred_at"
          : "unassigned_destination",
    });
    return NextResponse.json(
      { ok: true, data: { accepted: true, duplicate: ledger.data.process_status === "duplicate", normalized: false } },
      { status: 202 },
    );
  }
  const assignment = resolved;
  const normalizeAfterAck = () => after(async () => {
    try {
      const normalized = await normalizeTelnyxEvent({
        accountId: assignment.accountId,
        demoNumber: assignment.demoNumber,
        webhookEventId: ledger.data.id,
        event,
        ...(personalized
          ? { transcriptExpiresAt: new Date(occurredAt.getTime() + PROSPECT_CONTENT_RETENTION_DAYS * 24 * 60 * 60 * 1000) }
          : {}),
      });
      if (!personalized && normalized.finalized && normalized.callId) {
        await runCrmSyncForCall({
          accountId: assignment.accountId,
          callId: normalized.callId,
          sourceWebhookId: ledger.data.id,
        });
      }
    } catch (error) {
      await setWebhookProcessStatus({
        id: ledger.data.id,
        process_status: "error",
        process_error: error instanceof Error ? error.message : "normalization_failed",
      });
    }
  });

  if (ledger.data.process_status === "duplicate") {
    const state = await getWebhookProcessingState(ledger.data.id);
    const abandonedReceived =
      state?.process_status === "received" &&
      Date.now() - state.received_at.getTime() > 30_000;
    if (state?.process_status === "error" || abandonedReceived) {
      normalizeAfterAck();
    }
    return NextResponse.json({ ok: true, data: { accepted: true, duplicate: true } });
  }

  normalizeAfterAck();

  return NextResponse.json(
    { ok: true, data: { accepted: true, duplicate: false } },
    { status: 202 },
  );
}
