import { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { metadataOnly } from "@/lib/callReview/consent";
import { BusinessMemorySnapshotSchema } from "@/lib/prospectBootstrap/contracts";
import { after, NextResponse } from "next/server";
import { recordWebhookEvent, setWebhookProcessStatus } from "@/lib/data/webhookEvents";
import { errorResponse } from "@/lib/providers/webhook-helpers";
import {
  getTelnyxAgentTarget,
  getTelnyxCallId,
  getTelnyxOccurredAt,
  getTelnyxCallIds,
  parseTelnyxWebhook,
  verifyTelnyxWebhook,
} from "@/lib/providers/telnyx/webhook";
import {
  UnavailableAgentContextSchema,
  PROSPECT_CONTENT_RETENTION_DAYS,
} from "@/lib/prospectBootstrap/contracts";
import { resolveActiveProspectAgentContext } from "@/lib/prospectBootstrap/service";
import { findSupervisedNumberOwner, resolveSupervisedTenantForNumber } from "@/lib/agentExecution/supervisedRuntime";
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
  const startedAt = performance.now();
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

  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return errorResponse(415, {
      code: "unsupported_telnyx_initialization_content_type",
      message: "Telnyx assistant initialization requires application/json.",
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
  // Resolved against the event's own time, as the calls webhook does: a delayed
  // initialization for a number released and reassigned since must reach the
  // tenant that held the number when the call began, never the current holder.
  const occurredAt = getTelnyxOccurredAt(event);
  const resolutionStartedAt = performance.now();
  const supervised = target && occurredAt ? await resolveSupervisedTenantForNumber(target, occurredAt) : null;
  const resolutionDuration = performance.now() - resolutionStartedAt;
  const supervisedReady =
    supervised !== null &&
    supervised.readiness.ready &&
    supervised.providerEvidenceAuthorized;

  // Ownership is resolved separately from readiness: a supervised number whose
  // runtime fails closed still belongs to that tenant and never falls through
  // to the prospect lane.
  const owner = supervised
    ? { accountId: supervised.accountId, assignmentId: supervised.assignmentId }
    : target ? await findSupervisedNumberOwner(target, occurredAt ?? new Date()) : null;
  const supervisedOwned = owner !== null;

  const prospect =
    !supervisedOwned && target && process.env.RESPONSEOS_PROSPECT_BOOTSTRAP_ENABLED === "true"
      ? await resolveActiveProspectAgentContext(target)
      : null;

  const providerCallId = getTelnyxCallId(event.data.payload);

  // Ownership at receipt time routes an untimed event to the neutral response,
  // but attribution needs the event's own time: an untimed initialization is
  // stored unscoped rather than under whoever holds the number now.
  const ledger = await recordWebhookEvent({
    account_id: (occurredAt ? owner?.accountId : undefined) ?? prospect?.accountId,
    provider: "telnyx",
    provider_event_id: event.data.id,
    event_type: event.data.event_type,
    raw_body: JSON.stringify(metadataOnly(event)),
    signature_header: signature ?? undefined,
    signature_valid: true,
    provider_call_id: providerCallId ?? undefined,
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
  // A supervised call can only be answered with context when the payload
  // identifies it: without a call id there is no capture to pin the approved
  // snapshot to, and the response below falls back to the unavailable context.
  // Recording that outcome as processed would contradict what the caller got.
  if (supervisedReady && supervised) {
    if (!providerCallId || !db) {
      await setWebhookProcessStatus({ id: ledger.data.id, process_status: "rejected", process_error: "missing_provider_call_id" });
      return NextResponse.json({ dynamic_variables: SUPERVISED_UNAVAILABLE_CONTEXT });
    }
    const captureStartedAt = performance.now();
    const capture = await db.callCaptureSession.upsert({
      where: { account_id_provider_call_id: { account_id: supervised.accountId, provider_call_id: providerCallId } },
      create: {
        account_id: supervised.accountId,
        provider_call_id: providerCallId,
        assignment_id: supervised.assignmentId,
        snapshot_id: supervised.snapshotId,
        snapshot_json: supervised.memory as Prisma.InputJsonValue,
      },
      update: {},
    });
    const captureDuration = performance.now() - captureStartedAt;

    // The pinned snapshot is whatever the first delivery stored, so a schema
    // that has moved since would make a strict parse throw and return a 500
    // after the ledger already said processed. Fail closed to the same
    // unavailable context the other unresolvable paths use, and correct the
    // ledger so the evidence matches what the caller heard.
    const pinned = BusinessMemorySnapshotSchema.safeParse(capture.snapshot_json);
    if (!pinned.success) {
      await setWebhookProcessStatus({ id: ledger.data.id, process_status: "rejected", process_error: "pinned_snapshot_invalid" });
      return NextResponse.json({ dynamic_variables: SUPERVISED_UNAVAILABLE_CONTEXT });
    }

    after(() => setWebhookProcessStatus({ id: ledger.data.id, process_status: "processed" }));

    const renderStartedAt = performance.now();
    const response = NextResponse.json({
      dynamic_variables: buildSupervisedAgentContext({
        businessName: supervised.accountName,
        agentName: supervised.agentName,
        memory: pinned.data,
        policy: supervised.contextPolicy,
      }),
      conversation: {
        metadata: {
          responseos_account_id: supervised.accountId,
          responseos_assignment_id: supervised.assignmentId,
          execution_mode: supervised.contextPolicy.executionMode,
        },
      },
    });
    const renderDuration = performance.now() - renderStartedAt;
    const totalDuration = performance.now() - startedAt;
    response.headers.set("server-timing", `resolve;dur=${resolutionDuration.toFixed(1)}, capture;dur=${captureDuration.toFixed(1)}, render;dur=${renderDuration.toFixed(1)}, total;dur=${totalDuration.toFixed(1)}`);
    console.info(JSON.stringify({ event: "telnyx_initialization_timing", lane: supervised.assignmentStatus, total_ms: Math.round(totalDuration), resolution_ms: Math.round(resolutionDuration), capture_ms: Math.round(captureDuration), render_ms: Math.round(renderDuration) }));
    return response;
  }

  if (supervisedOwned) {
    await setWebhookProcessStatus({
      id: ledger.data.id,
      process_status: "rejected",
      process_error: supervised
        ? supervised.readiness.ready
          ? "supervised_tenant_not_authorized"
          : "supervised_configuration_incomplete"
        : occurredAt ? "supervised_runtime_unresolved" : "missing_occurred_at",
    });
    return NextResponse.json({
      dynamic_variables: SUPERVISED_UNAVAILABLE_CONTEXT,
      conversation: { metadata: { execution_mode: "SUPERVISED_UNAVAILABLE" } },
    });
  }


  if (prospect) {
    after(() => setWebhookProcessStatus({ id: ledger.data.id, process_status: "processed" }));
  } else {
    await setWebhookProcessStatus({
      id: ledger.data.id,
      process_status: "rejected",
      process_error: target ? "inactive_destination" : "missing_destination",
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
