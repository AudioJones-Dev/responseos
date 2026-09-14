import { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { metadataOnly } from "@/lib/callReview/consent";
import { BusinessMemorySnapshotSchema } from "@/lib/prospectBootstrap/contracts";
import { NextResponse } from "next/server";
import { recordWebhookEvent, setWebhookProcessStatus } from "@/lib/data/webhookEvents";
import { errorResponse } from "@/lib/providers/webhook-helpers";
import {
  getTelnyxAgentTarget,
  getTelnyxCallId,
  getTelnyxCallIds,
  parseTelnyxWebhook,
  verifyTelnyxWebhook,
} from "@/lib/providers/telnyx/webhook";
import {
  UnavailableAgentContextSchema,
  PROSPECT_CONTENT_RETENTION_DAYS,
} from "@/lib/prospectBootstrap/contracts";
import { resolveActiveProspectAgentContext } from "@/lib/prospectBootstrap/service";
import { isSupervisedNumber, resolveSupervisedTenantForNumber } from "@/lib/agentExecution/supervisedRuntime";
import {
  buildSupervisedAgentContext,
  SUPERVISED_UNAVAILABLE_CONTEXT,
} from "@/lib/agentExecution/supervisedContext";

const unavailable = UnavailableAgentContextSchema.parse({
  demo_available: "false",
  execution_mode: "PROSPECT_DEMO_UNAVAILABLE",
  business_name: "ResponseOS demonstration",
  approved_business_context: "This personalized demonstration is not currently active.",
  uncertainty_fallback: "This personalized demonstration is unavailable. Please contact AJ Digital for a supervised demonstration.",
});

/**
 * Answers Telnyx's dynamic-variables webhook at the start of a conversation.
 *
 * A supervised tenant resolves first, then the prospect-demo lane. A caller to
 * a real client's number must never hear demonstration wording, so the two
 * unavailable contexts are separate. The provider's default timeout for this
 * request is short, so it stays a small number of indexed reads.
 */
export async function POST(req: Request) {
  const publicKey = process.env.TELNYX_PUBLIC_KEY;
  if (process.env.RESPONSEOS_LIVE_TELNYX_INGEST_ENABLED !== "true" || !publicKey) {
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
  const supervised = target ? await resolveSupervisedTenantForNumber(target) : null;
  const supervisedReady =
    supervised !== null &&
    supervised.readiness.ready &&
    supervised.resolved.degraded === null &&
    supervised.resolved.mode === "SUPERVISED_PILOT";

  // Ownership is resolved separately from readiness: a supervised number whose
  // runtime fails closed still belongs to that tenant and never falls through
  // to the prospect lane.
  const supervisedOwned = supervised !== null || (target ? await isSupervisedNumber(target) : false);

  const prospect =
    !supervisedOwned && target && process.env.RESPONSEOS_PROSPECT_BOOTSTRAP_ENABLED === "true"
      ? await resolveActiveProspectAgentContext(target)
      : null;

  const ledger = await recordWebhookEvent({
    account_id: supervised?.accountId ?? prospect?.accountId,
    provider: "telnyx",
    provider_event_id: event.data.id,
    event_type: event.data.event_type,
    raw_body: JSON.stringify(metadataOnly(event)),
    signature_header: signature ?? undefined,
    signature_valid: true,
    provider_call_id: getTelnyxCallId(event.data.payload) ?? undefined,
    provider_call_ids: getTelnyxCallIds(event.data.payload),
    // This is the event that binds a call id to the number it reached; later
    // insight events carry no number and correlate back through this row.
    agent_target: target ?? undefined,
    ...(supervised
      ? {}
      : { payload_expires_at: new Date(Date.now() + PROSPECT_CONTENT_RETENTION_DAYS * 24 * 60 * 60 * 1000) }),
  });
  if (!ledger.ok) {
    return errorResponse(503, {
      code: "webhook_ledger_unavailable",
      message: "Telnyx webhook ledger is unavailable.",
    });
  }
  await setWebhookProcessStatus({
    id: ledger.data.id,
    process_status: supervisedReady || prospect ? "processed" : "rejected",
    process_error: supervisedReady || prospect
      ? undefined
      : supervised
        ? supervised.readiness.ready
          ? "supervised_tenant_not_authorized"
          : "supervised_configuration_incomplete"
        : supervisedOwned
          ? "supervised_runtime_unresolved"
          : target
          ? "inactive_destination"
          : "missing_destination",
  });

  if (supervisedReady && supervised) {
    const providerCallId = getTelnyxCallId(event.data.payload);
    if (!providerCallId || !db) return NextResponse.json({ dynamic_variables: SUPERVISED_UNAVAILABLE_CONTEXT });
    const capture = await db.callCaptureSession.upsert({
      where: { account_id_provider_call_id: { account_id: supervised.accountId, provider_call_id: providerCallId } },
      create: { account_id: supervised.accountId, provider_call_id: providerCallId, snapshot_id: supervised.snapshotId, snapshot_json: supervised.memory as Prisma.InputJsonValue }, update: {},
    });

    return NextResponse.json({
      dynamic_variables: buildSupervisedAgentContext({
        businessName: supervised.accountName,
        agentName: supervised.agentName,
        memory: BusinessMemorySnapshotSchema.parse(capture.snapshot_json),
        policy: supervised.resolved.policy,
      }),
      conversation: {
        metadata: {
          responseos_account_id: supervised.accountId,
          responseos_assignment_id: supervised.assignmentId,
          execution_mode: supervised.resolved.mode,
        },
      },
    });
  }

  if (supervisedOwned) {
    return NextResponse.json({
      dynamic_variables: SUPERVISED_UNAVAILABLE_CONTEXT,
      conversation: { metadata: { execution_mode: "SUPERVISED_UNAVAILABLE" } },
    });
  }

  return NextResponse.json({
    dynamic_variables: prospect?.context ?? unavailable,
    conversation: {
      metadata: prospect
        ? {
            responseos_account_id: prospect.accountId,
            responseos_bootstrap_id: prospect.bootstrapId,
            responseos_assignment_id: prospect.assignmentId,
            execution_mode: "PROSPECT_DEMO",
          }
        : { execution_mode: "PROSPECT_DEMO_UNAVAILABLE" },
    },
  });
}
