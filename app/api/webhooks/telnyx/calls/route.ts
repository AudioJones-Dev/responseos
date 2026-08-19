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
  parseTelnyxWebhook,
  verifyTelnyxWebhook,
} from "@/lib/providers/telnyx/webhook";

export async function POST(req: Request) {
  const publicKey = process.env.TELNYX_PUBLIC_KEY;
  const accountId = process.env.RESPONSEOS_DEMO_ACCOUNT_ID;
  const demoNumber = process.env.RESPONSEOS_DEMO_PHONE_E164;
  if (
    process.env.RESPONSEOS_LIVE_TELNYX_INGEST_ENABLED !== "true" ||
    !publicKey ||
    !accountId ||
    !demoNumber
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

  const ledger = await recordWebhookEvent({
    account_id: accountId,
    provider: "telnyx",
    provider_event_id: event.data.id,
    event_type: event.data.event_type,
    raw_body: rawBody,
    signature_header: signature ?? undefined,
    signature_valid: true,
  });
  if (!ledger.ok) {
    return errorResponse(503, {
      code: "webhook_ledger_unavailable",
      message: "Telnyx webhook ledger is unavailable.",
    });
  }
  const normalizeAfterAck = () => after(async () => {
    try {
      const normalized = await normalizeTelnyxEvent({
        accountId,
        demoNumber,
        webhookEventId: ledger.data.id,
        event,
      });
      if (normalized.finalized && normalized.callId) {
        await runCrmSyncForCall({
          accountId,
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
