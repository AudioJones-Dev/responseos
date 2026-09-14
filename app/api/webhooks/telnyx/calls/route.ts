import { canRetainCallContent, metadataOnly, withCaptureLock } from "@/lib/callReview/consent";
import { queueCallReview } from "@/lib/callReview/service";
import { after, NextResponse } from "next/server";
import { runCrmSyncForCall } from "@/lib/crm/syncFinalizedCall";
import {
  findAgentTargetForProviderCall,
  findInitializedProviderCallId,
  getWebhookProcessingState,
  recordWebhookEvent,
  setWebhookProcessStatus,
} from "@/lib/data/webhookEvents";
import { errorResponse } from "@/lib/providers/webhook-helpers";
import { normalizeTelnyxEvent } from "@/lib/providers/telnyx/normalize";
import {
  resolveSupervisedTenantForNumber,
  touchSupervisedAssignment,
} from "@/lib/agentExecution/supervisedRuntime";
import { resolveTelnyxEventAssignment } from "@/lib/prospectBootstrap/service";
import { PROSPECT_CONTENT_RETENTION_DAYS } from "@/lib/prospectBootstrap/contracts";
import {
  getTelnyxCallId,
  getTelnyxCallIds,
  getTelnyxAgentTarget,
  getTelnyxOccurredAt,
  parseTelnyxWebhook,
  verifyTelnyxWebhook,
} from "@/lib/providers/telnyx/webhook";

/**
 * Three lanes share this endpoint, resolved from the called number:
 *
 *   supervised — a customer tenant with a dedicated number. Full retention,
 *                CRM against the live provider, completed-interaction email.
 *   prospect   — a personalized demo bootstrap (ADR-0048). Unchanged.
 *   legacy     — the evergreen demo number (ADR-0047), kept as a documented
 *                compatibility shim through pilot certification.
 *
 * Post-call insight events carry no called number, only call-control ids, so
 * the destination is recovered from the signed events already in the ledger.
 */
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

  let providerCallId = getTelnyxCallId(event.data.payload);
  const directTarget = getTelnyxAgentTarget(event.data.payload);
  const correlatedTarget = directTarget
    ? null
    : await findAgentTargetForProviderCall({
        provider: "telnyx",
        providerCallIds: getTelnyxCallIds(event.data.payload),
      });
  const target = directTarget ?? correlatedTarget;
  const occurredAt = getTelnyxOccurredAt(event);
  const receivedAt = new Date();

  const supervised = target ? await resolveSupervisedTenantForNumber(target, occurredAt ?? receivedAt) : null;
  if (supervised && target) {
    providerCallId = await findInitializedProviderCallId({ provider: "telnyx", providerCallIds: getTelnyxCallIds(event.data.payload), target }) ?? providerCallId;
  }
  const supervisedReady = supervised?.readiness.ready === true &&
    supervised.resolved.degraded === null && supervised.resolved.mode === "SUPERVISED_PILOT";

  let resolved = !supervised &&
    process.env.RESPONSEOS_PROSPECT_BOOTSTRAP_ENABLED === "true" &&
    target &&
    occurredAt
    ? await resolveTelnyxEventAssignment({ target, occurredAt, receivedAt })
    : null;
  let personalized = true;
  const legacyAccountId = process.env.RESPONSEOS_DEMO_ACCOUNT_ID;
  const legacyNumber = process.env.RESPONSEOS_DEMO_PHONE_E164;
  if (
    !supervised &&
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

  // A supervised tenant is a real client: its call evidence is retained, not
  // aged out on the prospect content clock.
  const retainPayload = Boolean(supervised) || (!personalized && Boolean(resolved));
  const record = async (allowed: boolean, client?: import("@prisma/client").Prisma.TransactionClient) => recordWebhookEvent({
    client,

    account_id: supervised?.accountId ?? resolved?.accountId,
    provider: "telnyx",
    provider_event_id: event.data.id,
    event_type: event.data.event_type,
    raw_body: JSON.stringify(allowed ? event : metadataOnly(event)),
    signature_header: signature ?? undefined,
    signature_valid: true,
    provider_call_id: providerCallId ?? undefined,
    provider_call_ids: getTelnyxCallIds(event.data.payload),
    // Only a number the provider itself put on this event anchors correlation.
    agent_target: directTarget ?? undefined,
    ...(retainPayload
      ? {}
      : { payload_expires_at: new Date((occurredAt ?? receivedAt).getTime() + PROSPECT_CONTENT_RETENTION_DAYS * 24 * 60 * 60 * 1000) }),
  });
  const ledger = supervised && providerCallId
    ? await withCaptureLock(supervised.accountId, providerCallId, async (client) => record(supervisedReady && await canRetainCallContent(supervised.accountId, providerCallId, event, client), client))
    : await record(Boolean(resolved));
  if (!ledger.ok) {
    return errorResponse(503, {
      code: "webhook_ledger_unavailable",
      message: "Telnyx webhook ledger is unavailable.",
    });
  }

  if (supervised && !supervisedReady) {
    await setWebhookProcessStatus({ id: ledger.data.id, process_status: "rejected", process_error: "supervised_runtime_not_ready" });
    return NextResponse.json({ ok: true, data: { accepted: true, normalized: false } }, { status: 202 });
  }

  if (!supervised && (!target || !occurredAt || !resolved)) {
    await setWebhookProcessStatus({
      id: ledger.data.id,
      process_status: "rejected",
      process_error: !target
        ? providerCallId
          ? "awaiting_call_correlation"
          : "missing_destination"
        : !occurredAt
          ? "missing_occurred_at"
          : "unassigned_destination",
    });
    if (!target && providerCallId) return errorResponse(503, { code: "awaiting_call_correlation", message: "Call correlation is not available yet; redeliver this signed event." });
    return NextResponse.json(
      { ok: true, data: { accepted: true, duplicate: ledger.data.process_status === "duplicate", normalized: false } },
      { status: 202 },
    );
  }

  const assignment = supervised
    ? {
        accountId: supervised.accountId,
        demoNumber: supervised.numberE164,
        assignmentId: supervised.assignmentId,
      }
    : resolved!;
  const supervisedTenant = supervised;

  const normalizeAfterAck = () => after(async () => {
    try {
      const normalize = async (client?: import("@prisma/client").Prisma.TransactionClient) => {
        const contentAllowed = supervisedTenant && providerCallId
          ? await canRetainCallContent(assignment.accountId, providerCallId, event, client) : true;
        const normalized = await normalizeTelnyxEvent({
        client,
        accountId: assignment.accountId,
        ...(supervisedTenant && providerCallId ? { providerCallId } : {}),
        demoNumber: assignment.demoNumber,
        webhookEventId: ledger.data.id,
        event: contentAllowed ? event : metadataOnly(event),
        ...(supervisedTenant
          ? { options: { captureCallerIdentity: contentAllowed, createQuoteRequest: false, reviewRequired: true } }
          : {}),
        ...(!supervisedTenant && personalized && occurredAt
          ? { transcriptExpiresAt: new Date(occurredAt.getTime() + PROSPECT_CONTENT_RETENTION_DAYS * 24 * 60 * 60 * 1000) }
          : {}),
      });
        return { normalized, contentAllowed };
      };
      const { normalized, contentAllowed } = supervisedTenant && providerCallId
        ? await withCaptureLock(assignment.accountId, providerCallId, normalize) : await normalize();


      if (supervisedTenant) {
        await touchSupervisedAssignment(supervisedTenant.assignmentId, occurredAt ?? receivedAt);
        if (normalized.callId && contentAllowed) {
          await queueCallReview(assignment.accountId, normalized.callId, event.data.payload);
        }
        return;
      }

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
    const awaitingCorrelation = state?.process_status === "rejected" && state.process_error === "awaiting_call_correlation";
    if (state?.process_status === "error" || abandonedReceived || awaitingCorrelation) {
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
