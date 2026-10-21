import "@/lib/serverOnlyGuard";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { withCaptureLock } from "./consent";
import { assertReceiptAwareIsolation, drainWithdrawal, persistWithdrawalReceipt, withdrawalRequestHash } from "./withdrawalReceipt";

type Client = Prisma.TransactionClient;
export async function callHasWithdrawal(accountId: string, callId: string, client: Client | null = db as Client | null) {
  if (!client) throw new Error("database_unavailable");
  const call = await client.call.findFirst({ where: { id: callId, account_id: accountId }, select: { provider_call_id: true } });
  if (!call?.provider_call_id) return false;
  return providerCallHasWithdrawal(accountId, call.provider_call_id, client);
}
export async function providerCallHasWithdrawal(accountId: string, providerCallId: string, client: Client | null = db as Client | null) {
  if (!client) throw new Error("database_unavailable");
  await assertReceiptAwareIsolation(client);
  if (await client.callWithdrawalReceipt.findUnique({ where: { account_id_provider_call_id: { account_id: accountId, provider_call_id: providerCallId } }, select: { id: true } })) return true;
  const capture = await client.callCaptureSession.findUnique({ where: { account_id_provider_call_id: { account_id: accountId, provider_call_id: providerCallId } }, select: { withdrawal_received_at: true } });
  return Boolean(capture?.withdrawal_received_at || await client.callConsentEvent.findFirst({ where: { account_id: accountId, provider_call_id: providerCallId, action: "withdraw", artifact: "transcript" }, select: { id: true } }));
}

export function sourceTime(claim: unknown, received: Date, lower: Date | null, ended: Date | null) {
  const value = claim && typeof claim === "object" && !Array.isArray(claim) ? claim as Record<string, unknown> : {};
  const raw = typeof value.occurredAt === "string" ? value.occurredAt.slice(0, 128) : null;
  const canonical = raw && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(raw) ? new Date(raw) : null;
  const parsed = canonical && Number.isFinite(canonical.getTime()) && canonical.toISOString() === raw!.replace(/(?<!\.\d{3})Z$/, '.000Z') ? canonical : null;
  const trusted = value.attestation === "operator_witness" && Object.keys(value).every(k => ['occurredAt', 'attestation'].includes(k));
  const reason = !raw ? "missing_source_time" : !parsed ? "invalid_utc_timestamp" : !trusted ? "unverified_source" : parsed > received ? "future_source_time" : !lower || parsed < lower ? "before_supported_consent" : ended && parsed > ended ? "after_capture_end" : null;
  return { raw, parsed, reason, provenance: trusted ? "authenticated_operator_witness" : "unverified" };
}

export async function withdrawalActivity(client: Client, capture: { id: string; account_id: string; provider_call_id: string }, from: Date, received: Date) {
  const call = await client.call.findFirst({ where: { account_id: capture.account_id, provider_call_id: capture.provider_call_id }, select: { id: true } });
  const [commands, transcripts, reviews, crm, notifications, analyses, captureState, rawWrites, normalized, contentWrites, pilotTurns] = await Promise.all([
    client.telnyxCallCommand.findMany({ where: { account_id: capture.account_id, capture_session_id: capture.id, OR: [{ intended_at: { gte: from } }, { provider_responded_at: { gte: from } }, { status: { in: ["intent_recorded", "uncertain"] } }] }, select: { id: true, command_type: true, status: true, intended_at: true, provider_responded_at: true, provider_response_status: true, reconciliation_state: true } }),
    client.callTranscriptRevision.findMany({ where: { account_id: capture.account_id, capture_session_id: capture.id, OR: [{ created_at: { gte: from } }, { frozen_at: { gte: from } }] }, select: { id: true, created_at: true, frozen_at: true } }),
    call ? client.callReview.findMany({ where: { account_id: capture.account_id, call_id: call.id }, select: { id: true, status: true, created_at: true, dispatch_at: true, email_attempt_at: true, email_status: true, email_message_id: true, crm_status: true } }) : [],
    call ? client.crmSyncOperation.findMany({ where: { account_id: capture.account_id, call_id: call.id }, select: { id: true, status: true, created_at: true, updated_at: true, completed_at: true, provider_contact_id: true, provider_activity_id: true, provider_task_id: true, last_error_code: true } }) : [],
    call ? client.notification.findMany({ where: { account_id: capture.account_id, call_id: call.id }, select: { id: true, status: true, created_at: true, sent_at: true, attempt_count: true, provider_message_id: true, last_error_code: true } }) : [],
    call ? client.callPostCallAnalysis.findMany({ where: { account_id: capture.account_id, call_id: call.id, created_at: { gte: from } }, select: { id: true, created_at: true, transcript_revision_id: true, completeness: true } }) : [],
    client.callCaptureSession.findUnique({ where: { id: capture.id, account_id: capture.account_id }, select: { capture_started_at: true, capture_ended_at: true, content_admission_closed_at: true, withdrawal_received_at: true, control_state: true } }),
    client.webhookEvent.findMany({ where: { account_id: capture.account_id, provider_call_id: capture.provider_call_id }, select: { id: true, event_type: true, received_at: true, processed_at: true, process_status: true, payload_purged_at: true } }),
    client.$queryRaw`SELECT id, created_at, status::text, (transcript IS NOT NULL) AS transcript_present, (summary IS NOT NULL) AS summary_present FROM "Call" WHERE account_id = ${capture.account_id} AND provider_call_id = ${capture.provider_call_id}`,
    client.auditLog.findMany({ where: { account_id: capture.account_id, target_id: capture.provider_call_id, action: "call_content_write_observed" }, select: { id: true, created_at: true, metadata_json: true } }),
    client.grokTranscriptTurn.findMany({ where: { account_id: capture.account_id, session: { capture_id: capture.id }, occurred_at: { gte: from } }, select: { id: true, sequence: true, speaker: true, occurred_at: true } }),
  ]);
  return JSON.parse(JSON.stringify({ from, received, classification: "review_required_actual_activity_not_prevented", timing: "timestamps_are_observations_not_commit_times; preauthorized_content_may_commit_until_drain", contentWrites, rawWrites, normalized, commands, transcripts, pilotTurns, reviews, crm, notifications, analyses, captureState })) as Prisma.InputJsonValue;
}

export async function recordContentActivity(client: Client, accountId: string, providerCallId: string, webhookId: string, outcome: { rawHistory: boolean; normalized: boolean; transcript: boolean | null }) {
  await client.auditLog.create({ data: { account_id: accountId, actor_type: "system", action: "call_content_write_observed", category: "workflow", target_type: "ProviderCall", target_id: providerCallId, metadata_json: { webhookId, ...outcome, timing: "transaction_observation_not_commit_time" } } });
}

export async function recordWithdrawal(capture: { id: string; account_id: string; provider_call_id: string }, actorId: string, value: { eventKey: string; disclosureRef: string; evidenceRef: string; jurisdictionBasis: string; withdrawalSourceTime?: unknown }) {
  if (!db) throw new Error("database_unavailable");
  // Receipt commits independently; previously authorized content may finish until the drain commits.
  const receipt = await persistWithdrawalReceipt(capture, actorId, value);
  const received = receipt.received_at;
  await drainWithdrawal(capture);
  return recordWithdrawalEvidence(capture, actorId, value, received);
}

export async function recordWithdrawalEvidence(capture: { id: string; account_id: string; provider_call_id: string }, actorId: string, value: { eventKey: string; disclosureRef: string; evidenceRef: string; jurisdictionBasis: string; withdrawalSourceTime?: unknown }, received: Date, expectedGeneration?: number) {
  const requestHash = withdrawalRequestHash(value);
  return withCaptureLock(capture.account_id, capture.provider_call_id, async client => {
    if (expectedGeneration !== undefined) await client.$queryRaw`SELECT id FROM "CallCaptureSession" WHERE id = ${capture.id} AND account_id = ${capture.account_id} FOR NO KEY UPDATE`;
    const current = await client.callCaptureSession.findUniqueOrThrow({ where: { id: capture.id, account_id: capture.account_id } });
    if (expectedGeneration !== undefined && current.generation !== expectedGeneration) throw Error("withdrawal_target_mismatch");
    const key = `${capture.id}:${value.eventKey}`;
    const existing = await client.callConsentEvent.findUnique({ where: { event_key: key } });
    if (existing?.action === 'withdraw' && existing.request_hash === requestHash) return { event: existing, conflict: false };
    const conflict = Boolean(existing);
    const grant = await client.callConsentEvent.findFirst({ where: { account_id: capture.account_id, provider_call_id: capture.provider_call_id, action: 'grant', artifact: 'transcript' }, orderBy: { occurred_at: 'desc' } });
    const prior = await client.callConsentEvent.findFirst({ where: { account_id: capture.account_id, provider_call_id: capture.provider_call_id, action: 'withdraw', artifact: 'transcript' }, orderBy: { recorded_at: 'asc' } });
    const lower = grant?.occurred_at ?? null;
    const observed = new Date();
    const source = sourceTime(value.withdrawalSourceTime, observed, lower, current.capture_ended_at);
    const reason = !value.disclosureRef || !value.evidenceRef || !value.jurisdictionBasis ? 'missing_consent_references' : conflict ? 'idempotency_conflict' : prior && (!source.parsed || prior.source_occurred_at?.getTime() !== source.parsed.getTime() || prior.source_time_status !== 'verified') ? 'conflicting_withdrawal' : source.parsed && current.withdrawal_received_at && source.parsed > current.withdrawal_received_at && source.parsed <= observed ? 'after_first_receipt' : source.reason;
    const effective = !reason && source.parsed ? source.parsed : received;
    const eventKey = conflict ? `${key}:withdrawal:${requestHash}` : key;
    const snapshot = await withdrawalActivity(client, current, !reason ? effective : current.capture_started_at ?? grant?.occurred_at ?? current.created_at, received);
    const event = await client.callConsentEvent.upsert({ where: { event_key: eventKey }, update: {}, create: {
      account_id: capture.account_id, provider_call_id: capture.provider_call_id, event_key: eventKey, action: 'withdraw', artifact: 'transcript', disclosure_ref: value.disclosureRef, evidence_ref: value.evidenceRef, jurisdiction_basis: value.jurisdictionBasis,
      source_channel: 'call', actor_user_id: actorId, occurred_at: effective, recorded_at: received, source_occurred_at: source.parsed, source_time_claim: source.raw, source_time_status: reason ? 'review_required' : 'verified', source_time_reason: reason, source_provenance: source.provenance, request_hash: requestHash, review_activity_json: snapshot,
    } });
    const boundary = new Date(Math.min(effective.getTime(), current.withdrawal_received_at!.getTime(), current.content_admission_closed_at?.getTime() ?? Infinity));
    await client.callCaptureSession.update({ where: { id: current.id, account_id: current.account_id }, data: { control_state: current.control_state === 'STOPPED' ? 'STOPPED' : 'STOP_PENDING', content_admission_closed_at: boundary } });
    return { event, conflict };
  });
}
