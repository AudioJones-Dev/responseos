import "@/lib/serverOnlyGuard";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { GrokCallSession, Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { requireReviewOperator } from "@/lib/callReview/service";
import { requestOperatorEndCall } from "@/lib/callControl/endCall";
import { providerCallHasWithdrawal } from "@/lib/callReview/withdrawal";
import { validateCaptureAiEligibility, type AiStartTarget } from "@/lib/callControl/startAi";
import * as provider from "./provider";
import { authenticateStream, mediaClientState, mediaHash, startFrame } from "./mediaContract";

const LEASE_MS = 15000;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const target = (s: GrokCallSession): AiStartTarget => ({ id: s.capture_id, account_id: s.account_id, provider_call_id: s.provider_call_id, assignment_id: s.assignment_id, generation: s.generation, call_session_id: s.call_session_id, call_leg_id: s.call_leg_id });
const clock = async (tx: Prisma.TransactionClient) => (await tx.$queryRaw<{ now: Date }[]>`SELECT date_trunc('milliseconds', clock_timestamp() AT TIME ZONE 'UTC') AS now`)[0].now;
function database() { if (!db) throw Error("database_unavailable"); return db; }
async function lock(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT id FROM "GrokCallSession" WHERE id=${id} FOR UPDATE`;
  return tx.grokCallSession.findUniqueOrThrow({ where: { id } });
}
function same(s: GrokCallSession, t: AiStartTarget) {
  return JSON.stringify(target(s)) === JSON.stringify({ id: t.id, account_id: t.account_id, provider_call_id: t.provider_call_id, assignment_id: t.assignment_id, generation: t.generation, call_session_id: t.call_session_id, call_leg_id: t.call_leg_id });
}
async function authority(t: AiStartTarget, tx: Prisma.TransactionClient) {
  const e = await validateCaptureAiEligibility(t, tx);
  if (!e.capture.disclosure_completed_at) throw Error("disclosure_completion_required");
  return hash(JSON.stringify([e.grantId, e.grantHash, e.proofId, e.proofHash, e.snapshotHash, e.capture.disclosure_completed_at]));
}
async function stop(tx: Prisma.TransactionClient, s: GrokCallSession, reason: string) {
  if (!s.stopped_at) s = await tx.grokCallSession.update({ where: { id: s.id }, data: { stopped_at: await clock(tx), stop_reason: reason } });
  for (const [kind, resource] of [["telnyx_hangup", s.provider_call_id], ["xai_hangup", s.xai_call_id]] as const) {
    if (kind === "telnyx_hangup" && s.stop_reason === "operator_end") continue;
    if (resource) await tx.grokCallCommand.upsert({ where: { session_id_kind: { session_id: s.id, kind } }, create: { session_id: s.id, kind, resource }, update: {} });
  }
  return s;
}

export async function beginGrokHandoff(t: AiStartTarget) {
  const actor = await requireReviewOperator();
  provider.assertGrokQualified();
  const token = randomBytes(32).toString("hex");
  const claim = await database().$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "CallCaptureSession" WHERE id=${t.id} AND account_id=${t.account_id} FOR NO KEY UPDATE`;
    if (await tx.grokCallSession.findUnique({ where: { capture_id: t.id } })) throw Error("grok_handoff_consumed");
    if (await tx.telnyxCallCommand.findFirst({ where: { capture_session_id: t.id, command_type: "ai_assistant_start" } })) throw Error("voice_engine_already_claimed");
    const digest = await authority(t, tx), now = await clock(tx);
    const session = await tx.grokCallSession.create({ data: { capture_id: t.id, account_id: t.account_id, provider_call_id: t.provider_call_id, assignment_id: t.assignment_id!, generation: t.generation, call_session_id: t.call_session_id!, call_leg_id: t.call_leg_id!, authority_digest: digest, correlation_hash: hash(token), lease_expires_at: new Date(now.getTime() + LEASE_MS) } });
    const command = await tx.grokCallCommand.create({ data: { session_id: session.id, kind: "handoff", resource: session.provider_call_id, status: "uncertain", consumed_at: now } });
    await tx.auditLog.create({ data: { account_id: t.account_id, actor_type: "user", actor_user_id: actor.user.id, actor_role: actor.user.role, action: "grok_handoff_consumed", category: "workflow", target_type: "GrokCallSession", target_id: session.id, metadata_json: { commandId: command.id, captureId: t.id, generation: t.generation } } });
    return { session, command };
  });
  try {
    const currentActor = await requireReviewOperator();
    if (currentActor.user.id !== actor.user.id || currentActor.user.role !== actor.user.role) throw Error("operator_changed");
    const fresh = await database().grokCallSession.findUniqueOrThrow({ where: { id: claim.session.id } });
    const now = await clock(database() as unknown as Prisma.TransactionClient);
    if (fresh.stopped_at || fresh.lease_expires_at <= now || !same(fresh, t) || await authority(t, database() as unknown as Prisma.TransactionClient) !== fresh.authority_digest) throw Error("grok_presend_veto");
    const command = await database().grokCallCommand.findUniqueOrThrow({ where: { id: claim.command.id } });
    if (command.session_id !== fresh.id || command.resource !== fresh.provider_call_id || command.status !== "uncertain" || command.result_at) throw Error("grok_claim_changed");
    if (await providerCallHasWithdrawal(t.account_id, t.provider_call_id, database() as unknown as Prisma.TransactionClient)) throw Error("grok_presend_veto");
  } catch {
    await requestGrokStop(claim.session.id, "presend_veto");
    throw Error("grok_presend_veto");
  }
  const result = await provider.handoffToGrok(claim.session, token, claim.command.id).catch(() => "uncertain" as const);
  await saveResult(claim.command.id, claim.session.id, claim.command.resource, result);
  if (result !== "accepted") await requestGrokStop(claim.session.id, "handoff_unconfirmed");
  return { sessionId: claim.session.id, handoff: result, disconnectionConfirmed: false };
}

async function saveResult(id: string, sessionId: string, resource: string, result: provider.CommandResult) {
  const updated = await database().grokCallCommand.updateMany({ where: { id, session_id: sessionId, resource, status: "uncertain", result_at: null, consumed_at: { not: null } }, data: { status: result, result_at: await clock(database() as unknown as Prisma.TransactionClient) } });
  if (updated.count !== 1) throw Error("grok_result_identity_mismatch");
}

export async function acceptGrokIncoming(raw: string, headers: Headers) {
  if (Buffer.byteLength(raw) > 65536) throw Error("grok_payload_too_large");
  const proof = await provider.verifyIncomingSip(raw, headers);
  if (!/^[0-9a-f]{64}$/.test(proof.correlationToken) || proof.bodyDigest !== hash(raw) || !/^[A-Za-z0-9_-]{1,128}$/.test(proof.eventId) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(proof.callId)) throw Error("grok_verified_identity_invalid");
  const found = await database().grokCallSession.findUnique({ where: { correlation_hash: hash(proof.correlationToken) } });
  if (!found) throw Error("grok_correlation_unknown");
  return database().$transaction(async tx => {
    let s = await lock(tx, found.id);
    if (await tx.grokIncomingReceipt.findFirst({ where: { session_id: s.id, event_id: { startsWith: "stream:" } } })) throw Error("grok_transport_retarget_denied");
    if (s.xai_call_id && s.xai_call_id !== proof.callId) throw Error("grok_call_retarget_denied");
    const receipt = await tx.grokIncomingReceipt.findUnique({ where: { event_id: proof.eventId } });
    if (receipt && (receipt.session_id !== s.id || receipt.call_id !== proof.callId || receipt.body_digest !== proof.bodyDigest)) throw Error("grok_replay_conflict");
    if (!receipt) await tx.grokIncomingReceipt.create({ data: { event_id: proof.eventId, session_id: s.id, call_id: proof.callId, body_digest: proof.bodyDigest } });
    if (!s.xai_call_id) s = await tx.grokCallSession.update({ where: { id: s.id }, data: { xai_call_id: proof.callId } });
    if (s.stopped_at || s.lease_expires_at <= await clock(tx) || await providerCallHasWithdrawal(s.account_id, s.provider_call_id, tx)) s = await stop(tx, s, "late_incoming_after_stop");
    return { sessionId: s.id, stopped: Boolean(s.stopped_at), disconnectionConfirmed: false };
  });
}

export async function requestGrokStop(id: string, reason: string) {
  return database().$transaction(async tx => stop(tx, await lock(tx, id), reason));
}

export async function operatorEndGrok(t: AiStartTarget) {
  const actor = await requireReviewOperator();
  const s = await database().grokCallSession.findUnique({ where: { capture_id: t.id } });
  if (!s || !same(s, t)) throw Error("grok_target_mismatch");
  await database().$transaction(async tx => {
    await stop(tx, await lock(tx, s.id), "operator_end");
    await tx.auditLog.create({ data: { account_id: s.account_id, actor_type: "user", actor_user_id: actor.user.id, actor_role: actor.user.role, action: "grok_operator_end", category: "workflow", target_type: "GrokCallSession", target_id: s.id } });
  });
  return requestOperatorEndCall({ captureId: s.capture_id, expectedAccountId: s.account_id, expectedProviderCallId: s.provider_call_id, generation: s.generation });
}

export async function dispatchGrokTermination(id: string) {
  const results = await Promise.allSettled((["telnyx_hangup", "xai_hangup"] as const).map(async kind => {
    const claimed = await database().$transaction(async tx => {
      const s = await lock(tx, id);
      if (!s.stopped_at) return null;
      const c = await tx.grokCallCommand.findUnique({ where: { session_id_kind: { session_id: id, kind } } });
      if (!c || c.status !== "queued" || c.consumed_at || c.resource !== (kind === "telnyx_hangup" ? s.provider_call_id : s.xai_call_id)) return null;
      return tx.grokCallCommand.update({ where: { id: c.id }, data: { status: "uncertain", consumed_at: await clock(tx) } });
    });
    if (!claimed) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const result = await Promise.race([
      provider.terminateGrokCall(kind === "telnyx_hangup" ? "telnyx" : "xai", claimed.resource, claimed.id).catch(() => "uncertain" as const),
      new Promise<"uncertain">(resolve => { timer = setTimeout(() => resolve("uncertain"), 5000); }),
    ]).finally(() => { if (timer) clearTimeout(timer); });
    await saveResult(claimed.id, id, claimed.resource, result);
  }));
  if (results.some(result => result.status === "rejected")) throw Error("grok_termination_persistence_uncertain");
}

let watchdogAfter: string | undefined;
export async function watchdogGrokSweep() {
  const sessions = await database().grokCallSession.findMany({
    where: { ...(watchdogAfter ? { id: { gt: watchdogAfter } } : {}), OR: [
      { stopped_at: null },
      { commands: { some: { kind: { in: ["telnyx_hangup", "xai_hangup"] }, status: "queued", consumed_at: null } } },
    ] }, orderBy: { id: "asc" }, take: 16, select: { id: true },
  });
  watchdogAfter = sessions.length === 16 ? sessions.at(-1)!.id : undefined;
  let failed = 0;
  await Promise.all(sessions.map(async ({ id }) => {
    try {
      await database().$transaction(async tx => {
        await tx.$executeRaw`SET LOCAL lock_timeout = '1000ms'`;
        await tx.$executeRaw`SET LOCAL statement_timeout = '2000ms'`;
        const s = await lock(tx, id);
        const capture = await tx.callCaptureSession.findUnique({ where: { id: s.capture_id } });
        if (s.stopped_at || !capture || !same(s, capture) || capture.content_admission_closed_at || capture.call_disconnected_at || s.lease_expires_at <= await clock(tx) || await providerCallHasWithdrawal(s.account_id, s.provider_call_id, tx)) await stop(tx, s, "withdrawal_or_control_loss");
      });
      await dispatchGrokTermination(id);
    } catch { failed += 1; }
  }));
  return { inspected: sessions.length, failed };
}

export async function claimGrokWorker(id: string) {
  provider.assertGrokQualified();
  return database().$transaction(async tx => {
    const s = await lock(tx, id), now = await clock(tx);
    if (!s.xai_call_id || s.worker_token || s.stopped_at || s.lease_expires_at <= now || await authority(target(s), tx) !== s.authority_digest) throw Error("grok_worker_not_eligible");
    const session = await tx.grokCallSession.update({ where: { id }, data: { worker_token: randomUUID(), lease_expires_at: new Date(now.getTime() + LEASE_MS) } });
    const command = await tx.grokCallCommand.create({ data: { session_id: id, kind: "join", resource: s.xai_call_id, status: "uncertain", consumed_at: now } });
    return { session, command };
  });
}

export async function heartbeatGrok(id: string, workerToken: string) {
  return database().$transaction(async tx => {
    const s = await lock(tx, id), now = await clock(tx);
    const capture = await tx.callCaptureSession.findUnique({ where: { id: s.capture_id } });
    if (!capture || !same(s, capture) || capture.content_admission_closed_at || capture.call_disconnected_at || s.worker_token !== workerToken || s.stopped_at || s.lease_expires_at <= now || await providerCallHasWithdrawal(s.account_id, s.provider_call_id, tx)) {
      await stop(tx, s, "worker_lease_invalid");
      return false;
    }
    await tx.grokCallSession.update({ where: { id }, data: { lease_expires_at: new Date(now.getTime() + LEASE_MS) } });
    return true;
  });
}

export async function runGrokWorker(id: string) {
  const claimed = await claimGrokWorker(id);
  if (!await heartbeatGrok(id, claimed.session.worker_token!)) return;
  let connection: provider.ControlConnection | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  let ticking = false;
  try {
    if (await authority(target(claimed.session), database() as unknown as Prisma.TransactionClient) !== claimed.session.authority_digest) throw Error("grok_join_presend_veto");
    connection = await provider.connectGrokControl(claimed.session);
    if (!await heartbeatGrok(id, claimed.session.worker_token!)) return;
    await saveResult(claimed.command.id, id, claimed.command.resource, "accepted");
    timer = setInterval(() => {
      if (ticking) return;
      ticking = true;
      void heartbeatGrok(id, claimed.session.worker_token!).then(async alive => { if (!alive) await connection?.close(); }).catch(async () => { await connection?.close().catch(() => {}); }).finally(() => { ticking = false; });
    }, 3000);
    await connection.closed;
  } finally {
    if (timer) clearInterval(timer);
    await connection?.close().catch(() => {});
    await requestGrokStop(id, "control_connection_lost");
    await dispatchGrokTermination(id);
  }
}

export async function claimGrokMedia(headers: Headers, rawStart: string, trusted: { streamUrl: string; publicKey: string }) {
  provider.assertGrokQualified();
  const proof = authenticateStream(headers, trusted.streamUrl, trusted.publicKey);
  if (Buffer.byteLength(rawStart) > 16384) throw Error("stream_start_too_large");
  const frame = startFrame.parse(JSON.parse(rawStart));
  const found = await database().grokCallSession.findUnique({ where: { correlation_hash: proof.tokenHash } });
  if (!found) throw Error("stream_binding_unknown");
  return database().$transaction(async tx => {
    const s = await lock(tx, found.id), now = await clock(tx);
    if (s.worker_token || s.xai_call_id || s.stopped_at || s.lease_expires_at <= now) throw Error("stream_binding_consumed_or_stopped");
    if (frame.start.call_control_id !== s.provider_call_id || frame.start.call_session_id !== s.call_session_id || frame.start.client_state !== mediaClientState(s.capture_id, s.generation)) throw Error("stream_target_mismatch");
    if (await authority(target(s), tx) !== s.authority_digest) throw Error("stream_authority_changed");
    await tx.grokIncomingReceipt.create({ data: { event_id: `stream:${frame.stream_id}`, session_id: s.id, call_id: frame.stream_id, body_digest: mediaHash(`${proof.upgradeDigest}|${rawStart}`) } });
    const session = await tx.grokCallSession.update({ where: { id: s.id }, data: { worker_token: randomUUID(), lease_expires_at: new Date(now.getTime() + LEASE_MS) } });
    await tx.grokCallCommand.create({ data: { session_id: s.id, kind: "join", resource: frame.stream_id, status: "uncertain", consumed_at: now } });
    return { session, streamId: frame.stream_id };
  });
}

export async function bindGrokRealtime(id: string, workerToken: string, realtimeSessionId: string) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(realtimeSessionId)) throw Error("realtime_identity_invalid");
  return database().$transaction(async tx => {
    const s = await lock(tx, id);
    if (s.worker_token !== workerToken || s.stopped_at || s.lease_expires_at <= await clock(tx) || await authority(target(s), tx) !== s.authority_digest) throw Error("realtime_authority_closed");
    await tx.grokIncomingReceipt.create({ data: { event_id: `realtime:${realtimeSessionId}`, session_id: id, call_id: realtimeSessionId, body_digest: hash(`${id}|${workerToken}|${realtimeSessionId}|${provider.GROK_MODEL}`) } });
    const command = await tx.grokCallCommand.findUniqueOrThrow({ where: { session_id_kind: { session_id: id, kind: "join" } } });
    if (command.result_at || command.status !== "uncertain") throw Error("realtime_join_consumed");
    await tx.grokCallCommand.update({ where: { id: command.id }, data: { status: "accepted", result_at: await clock(tx) } });
  });
}
