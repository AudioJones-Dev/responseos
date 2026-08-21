import { NextResponse } from "next/server";
import { recordWebhookEvent, setWebhookProcessStatus } from "@/lib/data/webhookEvents";
import { errorResponse } from "@/lib/providers/webhook-helpers";
import {
  getTelnyxAgentTarget,
  parseTelnyxWebhook,
  verifyTelnyxWebhook,
} from "@/lib/providers/telnyx/webhook";
import {
  UnavailableAgentContextSchema,
  PROSPECT_CONTENT_RETENTION_DAYS,
} from "@/lib/prospectBootstrap/contracts";
import { resolveActiveProspectAgentContext } from "@/lib/prospectBootstrap/service";

const unavailable = UnavailableAgentContextSchema.parse({
  demo_available: "false",
  execution_mode: "PROSPECT_DEMO_UNAVAILABLE",
  business_name: "ResponseOS demonstration",
  approved_business_context: "This personalized demonstration is not currently active.",
  uncertainty_fallback: "This personalized demonstration is unavailable. Please contact AJ Digital for a supervised demonstration.",
});

export async function POST(req: Request) {
  const publicKey = process.env.TELNYX_PUBLIC_KEY;
  if (
    process.env.RESPONSEOS_LIVE_TELNYX_INGEST_ENABLED !== "true" ||
    process.env.RESPONSEOS_PROSPECT_BOOTSTRAP_ENABLED !== "true" ||
    !publicKey
  ) {
    return errorResponse(503, {
      code: "telnyx_initialization_disabled",
      message: "Telnyx assistant initialization is disabled or unavailable.",
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
  if (!event || event.data.event_type !== "assistant.initialization") {
    return errorResponse(422, {
      code: "invalid_telnyx_initialization",
      message: "Telnyx assistant initialization payload is invalid.",
    });
  }
  const target = getTelnyxAgentTarget(event.data.payload);
  const resolved = target ? await resolveActiveProspectAgentContext(target) : null;
  const ledger = await recordWebhookEvent({
    account_id: resolved?.accountId,
    provider: "telnyx",
    provider_event_id: event.data.id,
    event_type: event.data.event_type,
    raw_body: rawBody,
    signature_header: signature ?? undefined,
    signature_valid: true,
    payload_expires_at: new Date(Date.now() + PROSPECT_CONTENT_RETENTION_DAYS * 24 * 60 * 60 * 1000),
  });
  if (!ledger.ok) {
    return errorResponse(503, {
      code: "webhook_ledger_unavailable",
      message: "Telnyx webhook ledger is unavailable.",
    });
  }
  await setWebhookProcessStatus({
    id: ledger.data.id,
    process_status: resolved ? "processed" : "rejected",
    process_error: resolved ? undefined : target ? "inactive_destination" : "missing_destination",
  });

  return NextResponse.json({
    dynamic_variables: resolved?.context ?? unavailable,
    conversation: {
      metadata: resolved
        ? {
            responseos_account_id: resolved.accountId,
            responseos_bootstrap_id: resolved.bootstrapId,
            responseos_assignment_id: resolved.assignmentId,
            execution_mode: "PROSPECT_DEMO",
          }
        : { execution_mode: "PROSPECT_DEMO_UNAVAILABLE" },
    },
  });
}
