import { canRetainCallContent, metadataOnly, withCaptureLock } from "@/lib/callReview/consent";
import { hasQueuedReview, queueCallReview } from "@/lib/callReview/service";
import { after, NextResponse } from "next/server";
import { runCrmSyncForCall } from "@/lib/crm/syncFinalizedCall";
import {
  backfillWebhookEvent,
  findCallCorrelation,
  findInitializedProviderCallId,
  getWebhookProcessingState,
  recordWebhookEvent,
  setWebhookProcessStatus,
} from "@/lib/data/webhookEvents";
import { errorResponse } from "@/lib/providers/webhook-helpers";
import { normalizeTelnyxEvent } from "@/lib/providers/telnyx/normalize";
import {
  findSupervisedNumberOwner,
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
  const correlation = directTarget
    ? null
    : await findCallCorrelation({
        provider: "telnyx",
        providerCallIds: getTelnyxCallIds(event.data.payload),
      });
  const target = directTarget ?? correlation?.target ?? null;
  const occurredAt = getTelnyxOccurredAt(event);
  const receivedAt = new Date();
  // Tenant resolution is by the call's own time. A direct event carries it; a
  // correlated post-call event (insights arrive minutes after hangup with no
  // number) is anchored to the initialization that bound the call to the
  // number, because the number may have changed hands since. Receipt time is
  // never a substitute: a retried event from a number's previous tenant would
  // otherwise resolve to whoever holds the number now.
  const resolutionTime = directTarget ? occurredAt : (correlation?.anchoredAt ?? null);

  const supervised = target && resolutionTime ? await resolveSupervisedTenantForNumber(target, resolutionTime) : null;
  if (supervised && target) {
    providerCallId = await findInitializedProviderCallId({ provider: "telnyx", providerCallIds: getTelnyxCallIds(event.data.payload), target }) ?? providerCallId;
  }
  const supervisedReady = supervised?.readiness.ready === true &&
    supervised.resolved.degraded === null && supervised.resolved.mode === "SUPERVISED_PILOT";
  // Ownership is independent of whether the runtime resolves right now. An
  // owned number's event must never fall through to the prospect lane, where
  // it would be stored unscoped and never retried.
  const owner = supervised
    ? { accountId: supervised.accountId, assignmentId: supervised.assignmentId }
    : target ? await findSupervisedNumberOwner(target, resolutionTime ?? receivedAt) : null;
  const supervisedOwned = owner !== null;

  let resolved = !supervisedOwned &&
    process.env.RESPONSEOS_PROSPECT_BOOTSTRAP_ENABLED === "true" &&
    target &&
    occurredAt
    ? await resolveTelnyxEventAssignment({ target, occurredAt, receivedAt })
    : null;
  let personalized = true;
  const legacyAccountId = process.env.RESPONSEOS_DEMO_ACCOUNT_ID;
  const legacyNumber = process.env.RESPONSEOS_DEMO_PHONE_E164;
  if (
    !supervisedOwned &&
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
  // An owned number's event without a trustworthy time can never be attributed
  // to an assignment interval, so it is retained unscoped and ages out like
  // prospect data; only routing (never the prospect lane) uses the ownership.
  const attributable = supervisedOwned && resolutionTime !== null;
  const retainPayload = attributable || (!personalized && Boolean(resolved));
  const payloadExpiresAt = retainPayload ? null : new Date((occurredAt ?? receivedAt).getTime() + PROSPECT_CONTENT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  // Retained content is the exact signed bytes, so the stored body matches the
  // recorded signature; only the denied branch stores a projection.
  const retainedBody = (allowed: boolean) => (allowed ? rawBody : JSON.stringify(metadataOnly(event)));
  const record = async (allowed: boolean, client?: import("@prisma/client").Prisma.TransactionClient) => recordWebhookEvent({
    client,

    // The verified number assignment identifies the tenant even when its
    // runtime cannot be resolved — but only at the event's own time; an
    // untimed event is stored unscoped rather than under the current holder.
    account_id: (attributable ? owner?.accountId : undefined) ?? resolved?.accountId,
    provider: "telnyx",
    provider_event_id: event.data.id,
    event_type: event.data.event_type,
    raw_body: retainedBody(allowed),
    signature_header: signature ?? undefined,
    signature_valid: true,
    provider_call_id: providerCallId ?? undefined,
    provider_call_ids: getTelnyxCallIds(event.data.payload),
    // Only a number the provider itself put on this event anchors correlation.
    agent_target: directTarget ?? undefined,
    ...(payloadExpiresAt ? { payload_expires_at: payloadExpiresAt } : {}),
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

  if (supervisedOwned && !supervised) {
    // Owned, but not resolvable: either the event carries no trustworthy time
    // (permanent — never retried), or the runtime could not be resolved
    // (profile, snapshot, or snapshot JSON missing or invalid — retryable: a
    // redelivery after repair is picked up by the duplicate handler below).
    await setWebhookProcessStatus({ id: ledger.data.id, process_status: "rejected", process_error: resolutionTime ? "supervised_runtime_unresolved" : "missing_occurred_at" });
    // The retryable case answers 503 so the provider redelivers after repair
    // and the duplicate handler can normalize the retained event; acknowledging
    // it would leave recovery to a manual redelivery nobody is prompted to make.
    if (resolutionTime) return errorResponse(503, { code: "supervised_runtime_unresolved", message: "The supervised runtime for this number is not resolvable yet; redeliver this signed event." });
    return NextResponse.json({ ok: true, data: { accepted: true, normalized: false } }, { status: 202 });
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
        // The review revision is created inside the same capture-locked
        // transaction as the normalization it reflects, so no committed state
        // exists in which the evidence is newer than the latest revision.
        // The first review is queued only from the finalized insight event: a
        // hangup completes the call but carries no analysis, and a review built
        // from it could be dispatched before the evidence exists. Once a review
        // exists, any later evidence must produce a new revision, or the
        // existing one is stale against the canonical call and can never be
        // approved.
        if (supervisedTenant && normalized.callId && (normalized.finalized && contentAllowed || await hasQueuedReview(assignment.accountId, normalized.callId, client))) {
          await queueCallReview(assignment.accountId, normalized.callId, contentAllowed ? event.data.payload : metadataOnly(event).data.payload, client);
        }
        return { normalized, contentAllowed };
      };
      const { normalized } = supervisedTenant && providerCallId
        ? await withCaptureLock(assignment.accountId, providerCallId, normalize) : await normalize();

      if (supervisedTenant) {
        await touchSupervisedAssignment(supervisedTenant.assignmentId, occurredAt ?? receivedAt);
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
    const awaitingCorrelation = state?.process_status === "rejected" &&
      (state.process_error === "awaiting_call_correlation" || state.process_error === "supervised_runtime_unresolved");
    if (awaitingCorrelation) {
      // The row was recorded unscoped before the call could be correlated;
      // scope it to the tenant and its retention policy before it is processed.
      // Consent is re-read under the capture lock rather than reused from the
      // earlier ledger write, so a refusal recorded in between is honoured.
      const scope = async (allowed: boolean, client?: import("@prisma/client").Prisma.TransactionClient) => backfillWebhookEvent({
        client,
        id: ledger.data.id,
        account_id: assignment.accountId,
        raw_body: retainedBody(allowed),
        payload_expires_at: payloadExpiresAt,
        provider_call_id: providerCallId ?? undefined,
        provider_call_ids: getTelnyxCallIds(event.data.payload),
        agent_target: directTarget ?? undefined,
      });
      if (supervisedTenant && providerCallId) {
        await withCaptureLock(assignment.accountId, providerCallId, async (client) => scope(supervisedReady && await canRetainCallContent(assignment.accountId, providerCallId, event, client), client));
      } else {
        await scope(Boolean(resolved));
      }
    }
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
