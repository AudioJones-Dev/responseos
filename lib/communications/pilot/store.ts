import "@/lib/serverOnlyGuard";
import { createHash, randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import type { TelnyxWebhookEnvelope } from "@/lib/providers/telnyx/webhook";
import { contentFreeReceipt } from "@/lib/providers/telnyx/content-policy";
import { decodeToken, legFromPayload, observation, pilotRequest, type PilotTransport } from "@/lib/providers/telnyx/pilot";
import { configDigest, pilotOpen, type PilotConfig } from "./config";
import { acceptPilotCommand, approvePilot, commandAllowed, endPilot, initialPilot, pendingPilot, latest, observePilot, tickPilot, type Intent, type PilotState } from "./machine";

import { bindSpeechConversation } from "./speech";

type Database = Pick<PrismaClient, "$transaction">;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
async function lock(tx: Prisma.TransactionClient, accountId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`frl-pilot:${accountId}`}, 0))`;
}
async function activeAccount(tx: Prisma.TransactionClient, accountId: string): Promise<boolean> {
  // to_jsonb also honors #236's draft deny marker when that additive column is present.
  const rows = await tx.$queryRaw<{ allowed: boolean }[]>`SELECT ("status" = 'active' AND (to_jsonb(a)->>'setup_draft_json') IS NULL) AS allowed FROM "Account" a WHERE "id" = ${accountId} FOR SHARE`;
  return rows[0]?.allowed === true;
}
async function windowKilled(tx: Prisma.TransactionClient, c: PilotConfig): Promise<boolean> {
  return !!await tx.auditLog.findFirst({ where: { account_id: c.accountId, action: "frl_pilot.kill", target_type: "FrlPilotWindow", target_id: c.windowId }, select: { id: true } });
}
async function persist(tx: Prisma.TransactionClient, c: PilotConfig, s: PilotState, previous: PilotState, now: number) {
  if (s.admission && (s.stage !== "pending" || now >= s.deadline)) s.admission.caller = "<PURGED>";
  await tx.frlPilotRun.update({ where: { id: s.id, account_id: c.accountId }, data: { state_json: s as unknown as Prisma.InputJsonValue, closed: s.stage === "ended" } });
  for (const i of s.intents.filter(i => !previous.intents.some(old => old.id === i.id))) {
    await tx.frlPilotCommand.create({ data: { id: i.id, account_id: c.accountId, run_id: s.id, purpose: i.purpose, intent_json: i, deadline: new Date(i.deadline) } });
  }
  for (const grant of s.grants.slice(previous.grants.length)) {
    await tx.auditLog.create({ data: { account_id: c.accountId, actor_type: "system", action: "frl_pilot.consent", category: "workflow", target_type: "FrlPilotRun", target_id: s.id, metadata_json: { ...grant } } });
  }
  if (s.revokedAt && !previous.revokedAt || s.incident && s.incident !== previous.incident) {
    await tx.auditLog.create({ data: { account_id: c.accountId, actor_type: "system", action: "frl_pilot.safety", category: "workflow", target_type: "FrlPilotRun", target_id: s.id, metadata_json: { reason: s.incident ?? "withdrawn", revoked: !!s.revokedAt, at: now } } });
  }
  if (s.revokedAt) await tx.frlPilotArtifact.updateMany({ where: { account_id: c.accountId, run_id: s.id }, data: { transcript: null, purged_at: new Date(now) } });
  if (s.stage === "ending" || s.stage === "ended") await tx.frlPilotDeletion.updateMany({ where: { account_id: c.accountId, run_id: s.id, kind: "conversation", state: { not: "verified" } }, data: { due_at: new Date(now), next_attempt_at: new Date(now) } });
  if (s.revokedAt) await tx.frlPilotDeletion.updateMany({ where: { account_id: c.accountId, run_id: s.id, state: { not: "verified" } }, data: { due_at: new Date(now), next_attempt_at: new Date(now) } });
  if (s.stage === "ending" || s.stage === "ended") {
    await tx.frlPilotCommand.updateMany({ where: { account_id: c.accountId, run_id: s.id, state: "pending", purpose: { notIn: ["stop", "hangup", "monitor_stop"] } }, data: { state: "cancelled", finished_at: new Date(now) } });
  }
  if (s.stage === "ended") {
    const run = await tx.frlPilotRun.findFirstOrThrow({ where: { account_id: c.accountId, id: s.id } });
    await tx.call.updateMany({ where: { account_id: c.accountId, id: run.call_id }, data: { status: "completed", ended_at: new Date(now) } });
  }
}

export async function ingestPilot(db: Database, c: PilotConfig, event: TelnyxWebhookEnvelope, rawBody: string, now = Date.now(), env: Record<string, string | undefined> = process.env) {
  if (event.data.payload.connection_id !== c.applicationId) return { handled: false };
  return db.$transaction(async tx => {
    await lock(tx, c.accountId);
    const eventHash = digest(`telnyx:${event.data.id}`);
    if (await tx.webhookEvent.findUnique({ where: { dedupe_hash: eventHash } })) return { handled: true, duplicate: true };
    const receipt = await tx.webhookEvent.create({ data: { account_id: c.accountId, provider: "telnyx", provider_event_id: eventHash, dedupe_hash: eventHash,
      event_type: "frl_pilot.receipt", raw_body: contentFreeReceipt(rawBody), signature_valid: true, payload_expires_at: new Date(now + 86400000) } });
    const finish = async (accepted: boolean) => {
      await tx.webhookEvent.update({ where: { id: receipt.id, account_id: c.accountId }, data: { process_status: accepted ? "processed" : "rejected", processed_at: new Date(now) } });
      return { handled: true, accepted };
    };
    const leg = legFromPayload(event.data.payload);
    const at = Date.parse(event.data.occurred_at ?? "");
    if (!leg || !Number.isFinite(at) || at > now + 2000 || at < Date.parse(c.opensAt)) return finish(false);
    const token = decodeToken(event.data.payload.client_state);
    let row = token ? await tx.frlPilotRun.findFirst({ where: { id: token.runId, account_id: c.accountId } }) : null;
    if (!row) {
      // Only bound identities may correlate callbacks whose client_state is absent (not phone numbers).
      const rows = await tx.frlPilotRun.findMany({ where: { account_id: c.accountId, window_id: c.windowId } });
      row = rows.find(r => { const s = r.state_json as unknown as PilotState; return [s.caller, s.operator].some(l => l?.controlId === leg.controlId && l.legId === leg.legId && l.sessionId === leg.sessionId) || event.data.event_type === "call.bridged" && s.caller.sessionId === leg.sessionId; }) ?? null;
    }
    if (!row) {
      const p = event.data.payload;
      if (event.data.event_type !== "call.initiated" || p.direction !== "incoming" || p.to !== c.number || typeof p.from !== "string" || !/^\+1[2-9]\d{9}$/.test(p.from) || [c.number, c.operator].includes(p.from) || now - at >= 20000 ||
          !pilotOpen(c, now, env) || await windowKilled(tx, c) || !(await activeAccount(tx, c.accountId))) return finish(false);
      if (await tx.frlPilotRun.count({ where: { account_id: c.accountId, closed: false } }) ||
          await tx.frlPilotRun.count({ where: { account_id: c.accountId, window_id: c.windowId } }) >= c.maxCalls) return finish(false);
      const id = randomUUID();
      if (c.admission === "automatic_once" && await tx.frlPilotDeletion.count({ where: { account_id: c.accountId, state: { not: "verified" }, due_at: { lte: new Date(now) } } })) return finish(false);
      const s = c.admission === "automatic_once"
        ? { ...initialPilot(id, leg, at, Date.parse(c.closesAt), c.disclosureVersion), exercise: c.exercise, captureDenied: true }
        : pendingPilot(id, leg, p.from, at, Date.parse(c.closesAt), c.disclosureVersion, c.exercise);
      if (c.exercise === "recorded" && c.speech) (s as PilotState).speech = { bindings: [], monitors: {} };
      const call = await tx.call.create({ data: { account_id: c.accountId, provider: "telnyx", provider_call_id: leg.controlId,
        direction: "inbound", status: "ringing", from_number: "<CONTROLLED_PILOT_CALLER>", to_number: c.number, started_at: new Date(at) } });
      await tx.frlPilotRun.create({ data: { id, account_id: c.accountId, call_id: call.id, window_id: c.windowId, config_digest: configDigest(c),
        state_json: s as unknown as Prisma.InputJsonValue, started_at: new Date(now), expires_at: new Date(now + c.retentionHours * 3600000) } });
      await persist(tx, c, s, { ...s, intents: [] }, now);
      if (c.admission === "automatic_once") await tx.auditLog.create({ data: { account_id: c.accountId, actor_type: "system", action: "frl_pilot.auto_admit", category: "workflow", target_type: "FrlPilotRun", target_id: id,
        metadata_json: { windowId: c.windowId, approvalRef: c.commissioning.approvalRef, identity: "unverified_commissioning_caller", admission: c.admission } } });
      return finish(true);
    }
    const previous = row.state_json as unknown as PilotState;
    let s = structuredClone(previous);
    if (row.config_digest !== configDigest(c)) { endPilot(s, now, "configuration_changed", true); await persist(tx, c, s, previous, now); return finish(false); }
    if (!s.operator && token && token.commandId === latest(s, "dial")?.id && ["call.initiated", "call.answered", "call.hangup"].includes(event.data.event_type)) {
      const dial = await tx.frlPilotCommand.findFirst({ where: { id: token.commandId, account_id: c.accountId, run_id: s.id, state: { in: ["dispatched", "accepted", "uncertain"] } } });
      if (dial && event.data.payload.from === c.number && event.data.payload.to === c.operator && leg.sessionId === s.caller.sessionId && leg.controlId !== s.caller.controlId && leg.legId !== s.caller.legId) { s.operator = leg; s.dialUnknown = false; }
    }
    if (s.speech && event.data.event_type === "call.conversation.created") {
      const index = s.speech.bindings.findIndex(b => b.commandId === token?.commandId);
      const existing = index >= 0 ? s.speech.bindings[index] : undefined;
      const conflicting = existing?.conversationId && existing.conversationId !== event.data.payload.conversation_id;
      const bound = existing ? bindSpeechConversation(event, conflicting ? { ...existing, conversationId: undefined } : existing, c.accountId, now) : null;
      const sent = bound && await tx.frlPilotCommand.findFirst({ where: { account_id: c.accountId, run_id: s.id, id: bound.commandId, state: { in: ["dispatched", "accepted", "uncertain"] } } });
      if (!bound || !sent) return finish(false);
      if (conflicting) {
        s.speech.bindings.push(bound);
        endPilot(s, now, "speech_conversation_identity_changed", true);
      } else s.speech.bindings[index] = bound;
      const due = new Date(s.revokedAt || bound.consumedAt || ["ending", "ended"].includes(s.stage) ? now : bound.issuedAt + 86400000);
      await tx.frlPilotDeletion.upsert({ where: { account_id_kind_resource_id: { account_id: c.accountId, kind: "conversation", resource_id: bound.conversationId! } },
        update: { state: "pending", verified_at: null, due_at: due, next_attempt_at: due },
        create: { account_id: c.accountId, run_id: s.id, kind: "conversation", resource_id: bound.conversationId!, recording_id: null,
          call_control_id: bound.leg.controlId, call_leg_id: bound.leg.legId, call_session_id: bound.leg.sessionId, due_at: due, next_attempt_at: due } });
    }
    if (s.speech && event.data.event_type === "call.conversation.ended") {
      const b = s.speech.bindings.find(b => b.conversationId === event.data.payload.conversation_id && b.leg.controlId === leg.controlId && b.leg.legId === leg.legId && b.leg.sessionId === leg.sessionId);
      if (!b) return finish(false);
      await tx.frlPilotDeletion.updateMany({ where: { account_id: c.accountId, run_id: s.id, kind: "conversation", resource_id: b.conversationId }, data: { state: "pending", verified_at: null, due_at: new Date(now), next_attempt_at: new Date(now) } });
    }
    if (s.speech && event.data.event_type === "call.ai_gather.ended") {
      const binding = s.speech.bindings.find(b => b.commandId === token?.commandId);
      if (binding && !binding.conversationId) throw new Error("pilot_speech_conversation_evidence_pending");
    }
    const observed = observation(event, s, now);
    if (!observed && event.data.event_type === "call.bridged" && leg.sessionId === s.caller.sessionId) { s.topologyUnknown = true; endPilot(s, now, "unknown_bridge_participant", true); }
    if (observed && !["hangup", "withdraw", "failure", "monitor_signal"].includes(observed.kind)) {
      const command = observed.token ? await tx.frlPilotCommand.findFirst({ where: { id: observed.token, account_id: c.accountId, run_id: s.id, state: { in: ["dispatched", "accepted", "uncertain"] } } }) : null;
      if (!command) return finish(false);
    }
    if (observed) s = observePilot(s, observed, now);
    if (observed?.kind === "speech_consent") {
      const b = s.speech!.bindings.find(b => b.commandId === observed.token)!;
      b.consumedAt = now;
      await tx.frlPilotDeletion.updateMany({ where: { account_id: c.accountId, run_id: s.id, kind: "conversation", resource_id: b.conversationId }, data: { state: "pending", verified_at: null, due_at: new Date(now), next_attempt_at: new Date(now) } });
    }
    if (observed?.kind === "answered" && observed.role === "caller") await tx.call.updateMany({ where: { account_id: c.accountId, id: row.call_id }, data: { status: "answered" } });
    if (s.stage !== "ended" && !pilotOpen(c, now, env) || env.RESPONSEOS_FRL_PILOT_KILL === "true" || await windowKilled(tx, c) || !(await activeAccount(tx, c.accountId))) endPilot(s, now, "dispatch_closed", true);
    if (s.stage === "ending") endPilot(s, now);
    const recordingId = z.string().uuid().safeParse(event.data.payload.recording_id);
    if (event.data.event_type === "call.recording.saved" && recordingId.success && leg.controlId === s.caller.controlId && leg.legId === s.caller.legId && leg.sessionId === s.caller.sessionId) {
      const window = previous.windows.find(w => w.commandId === token?.commandId);
      const sent = window && await tx.frlPilotCommand.findFirst({ where: { account_id: c.accountId, run_id: s.id, id: window.commandId, state: { in: ["dispatched", "accepted", "uncertain"] } } });
      if (window && sent) {
        const due = new Date(s.revokedAt ? now : Math.min(row.expires_at.getTime(), window.authorizedAt + c.retentionHours * 3600000));
        await tx.frlPilotDeletion.upsert({ where: { account_id_kind_resource_id: { account_id: c.accountId, kind: "recording", resource_id: recordingId.data } }, update: {},
          create: { account_id: c.accountId, run_id: s.id, recording_id: recordingId.data, resource_id: recordingId.data, kind: "recording", due_at: due, next_attempt_at: due } });
      }
    }
    if (event.data.event_type === "call.recording.transcription.saved" && leg.controlId === s.caller.controlId && leg.legId === s.caller.legId && leg.sessionId === s.caller.sessionId) {
      const ids = z.object({ recording_id: z.string().uuid(), recording_transcription_id: z.string().uuid() }).safeParse(event.data.payload);
      if (ids.success) {
        const owner = await tx.frlPilotDeletion.findFirst({ where: { account_id: c.accountId, run_id: s.id, kind: "recording", resource_id: ids.data.recording_id } });
        if (!owner) throw new Error("pilot_recording_evidence_pending");
        const due = s.revokedAt ? new Date(now) : owner.due_at;
        await tx.frlPilotDeletion.upsert({ where: { account_id_kind_resource_id: { account_id: c.accountId, kind: "transcription", resource_id: ids.data.recording_transcription_id } }, update: {},
          create: { account_id: c.accountId, run_id: s.id, recording_id: ids.data.recording_id, resource_id: ids.data.recording_transcription_id, kind: "transcription", due_at: due, next_attempt_at: due } });
      }
    }
    const recording = observed?.kind === "recording" ? s.windows.find(w => w.recordingId === observed.recordingId) : undefined;
    if (recording && !s.revokedAt && row.expires_at.getTime() > now) {
      await tx.frlPilotArtifact.upsert({ where: { account_id_recording_id: { account_id: c.accountId, recording_id: recording.recordingId! } }, update: {},
        create: { account_id: c.accountId, run_id: s.id, window_id: recording.id, recording_id: recording.recordingId!, purpose: recording.purpose,
          started_at: new Date(recording.startedAt!), ended_at: new Date(recording.endedAt!), expires_at: row.expires_at } });
    }
    if (event.data.event_type === "call.recording.transcription.saved" && !s.revokedAt && row.expires_at.getTime() > now && leg.controlId === s.caller.controlId && leg.legId === s.caller.legId && leg.sessionId === s.caller.sessionId) {
      const t = z.object({ recording_id: z.string().uuid(), status: z.literal("completed"), transcription_text: z.string().min(1).max(30000) }).safeParse(event.data.payload);
      const w = t.success ? s.windows.find(w => w.recordingId === t.data.recording_id && w.endedAt) : undefined;
      if (t.success && w) await tx.frlPilotArtifact.updateMany({ where: { account_id: c.accountId, run_id: s.id, recording_id: t.data.recording_id, purged_at: null, transcript: null, expires_at: { gt: new Date(now) } }, data: { transcript: t.data.transcription_text } });
      // Retry delivery after recording.saved; never stage unproven transcript text in the ledger.
      else if (t.success && !w) throw new Error("pilot_recording_evidence_pending");
    }
    await persist(tx, c, s, previous, now);
    return finish(!!observed || ["call.recording.transcription.saved", "call.conversation.created", "call.conversation.ended"].includes(event.data.event_type));
  });
}

export async function dispatchPilot(db: Database, c: PilotConfig, transport: PilotTransport, now = Date.now(), env: Record<string, string | undefined> = process.env) {
  // One durable claim per invocation. A crash after claim is uncertain and is never blindly retried.
  const claimed = await db.$transaction(async tx => {
    await lock(tx, c.accountId);
    const enabled = pilotOpen(c, now, env) && !await windowKilled(tx, c) && await activeAccount(tx, c.accountId);
    const rows = await tx.frlPilotRun.findMany({ where: { account_id: c.accountId, closed: false } });
    for (const row of rows) {
      const old = row.state_json as unknown as PilotState;
      const s = tickPilot(old, now, enabled && row.config_digest === configDigest(c));
      const abandoned = await tx.frlPilotCommand.findMany({ where: { account_id: c.accountId, run_id: s.id, state: "dispatched", dispatched_at: { lt: new Date(now - 10000) } } });
      if (abandoned.length) {
        await tx.frlPilotCommand.updateMany({ where: { account_id: c.accountId, id: { in: abandoned.map(i => i.id) } }, data: { state: "uncertain", finished_at: new Date(now) } });
        endPilot(s, now, "dispatch_outcome_unknown", true);
      }
      await persist(tx, c, s, old, now);
      const pending = await tx.frlPilotCommand.findMany({ where: { account_id: c.accountId, run_id: s.id, state: "pending" }, orderBy: { deadline: "asc" } });
      for (const command of pending) {
        const intent = command.intent_json as unknown as Intent;
        if (!commandAllowed(s, intent, now)) { await tx.frlPilotCommand.update({ where: { id: command.id, account_id: c.accountId }, data: { state: "cancelled", finished_at: new Date(now) } }); continue; }
        await tx.frlPilotCommand.update({ where: { id: command.id, account_id: c.accountId }, data: { state: "dispatched", dispatched_at: new Date(now) } });
        if (intent.purpose === "dial") {
          s.dialUnknown = true;
          await tx.frlPilotRun.update({ where: { id: s.id, account_id: c.accountId }, data: { state_json: s as unknown as Prisma.InputJsonValue } });
        }
        return { runId: s.id, intent };
      }
    }
    return null;
  });
  if (!claimed) return false;
  await db.$transaction(async tx => {
    await lock(tx, c.accountId);
    const dispatchNow = Math.max(now, Date.now());
    const row = await tx.frlPilotRun.findFirstOrThrow({ where: { id: claimed.runId, account_id: c.accountId } });
    const previous = row.state_json as unknown as PilotState;
    const s = structuredClone(previous);
    const cleanup = ["stop", "hangup", "monitor_stop"].includes(claimed.intent.purpose);
    if ((!cleanup && (!pilotOpen(c, dispatchNow, env) || await windowKilled(tx, c) || !await activeAccount(tx, c.accountId) || row.config_digest !== configDigest(c))) || !commandAllowed(s, claimed.intent, dispatchNow)) {
      await tx.frlPilotCommand.update({ where: { id: claimed.intent.id, account_id: c.accountId }, data: { state: "cancelled", finished_at: new Date(now) } });
      if (claimed.intent.purpose === "dial") s.dialUnknown = false;
      endPilot(s, now, "dispatch_closed", true); await persist(tx, c, s, previous, now); return;
    }
    if (s.speech && ["caller_consent", "operator_consent"].includes(claimed.intent.purpose) && !s.speech.bindings.some(b => b.commandId === claimed.intent.id)) {
      s.speech.bindings.push({ accountId: c.accountId, applicationId: c.applicationId, runId: s.id, commandId: claimed.intent.id,
        role: claimed.intent.role, leg: s[claimed.intent.role]!, disclosure: "frl-spoken-v1", issuedAt: dispatchNow, expiresAt: s.deadline });
    }
    const result = await transport(pilotRequest(s, claimed.intent, c, dispatchNow), claimed.intent.purpose === "dial");
    if (result.kind === "accepted" && result.leg) {
      if (result.leg.sessionId !== s.caller.sessionId || result.leg.controlId === s.caller.controlId || result.leg.legId === s.caller.legId || s.operator && JSON.stringify(s.operator) !== JSON.stringify(result.leg)) endPilot(s, now, "dial_identity_mismatch", true);
      else { s.operator = result.leg; s.dialUnknown = false; }
    }
    if (result.kind === "accepted") acceptPilotCommand(s, claimed.intent, dispatchNow);
    if (result.kind === "failed" && claimed.intent.purpose === "dial") s.dialUnknown = false;
    if (result.kind !== "accepted") endPilot(s, now, `command_${result.kind}`, true);
    await tx.frlPilotCommand.update({ where: { id: claimed.intent.id, account_id: c.accountId }, data: { state: result.kind, finished_at: new Date(now) } });
    await persist(tx, c, s, previous, now);
  }, { timeout: 10000, maxWait: 10000 });
  return true;
}

export async function purgePilotContent(db: Database, c: PilotConfig, now = Date.now()) {
  return db.$transaction(async tx => tx.frlPilotArtifact.updateMany({ where: { account_id: c.accountId, expires_at: { lte: new Date(now) }, purged_at: null }, data: { transcript: null, purged_at: new Date(now) } }));
}

export async function killPilotWindow(db: Database, c: PilotConfig, actorId: string, now = Date.now()) {
  return db.$transaction(async tx => {
    await lock(tx, c.accountId);
    if (!await windowKilled(tx, c)) await tx.auditLog.create({ data: { account_id: c.accountId, actor_type: "user", actor_user_id: actorId, action: "frl_pilot.kill", category: "workflow", target_type: "FrlPilotWindow", target_id: c.windowId, metadata_json: { reason: "operator_emergency_stop" } } });
    const runs = await tx.frlPilotRun.findMany({ where: { account_id: c.accountId, closed: false } });
    for (const row of runs) {
      const old = row.state_json as unknown as PilotState; const s = structuredClone(old);
      endPilot(s, now, "operator_emergency_stop", true); await persist(tx, c, s, old, now);
    }
    return { queuedForTermination: runs.length, windowClosed: true };
  });
}

export async function decidePilotAdmission(db: Database, c: PilotConfig, actorId: string, runId: string, approve: boolean, now = Date.now(), env: Record<string, string | undefined> = process.env) {
  if (c.admission !== "manual") return false;
  return db.$transaction(async tx => {
    await lock(tx, c.accountId);
    const row = await tx.frlPilotRun.findFirst({ where: { account_id: c.accountId, window_id: c.windowId, id: runId, closed: false } });
    if (!row || row.config_digest !== configDigest(c)) return false;
    const old = row.state_json as unknown as PilotState;
    const s = structuredClone(old);
    if (s.stage !== "pending" || !s.admission || s.admission.approvedAt || s.caller.endedAt || now >= s.deadline) return false;
    if (approve) {
      if (!pilotOpen(c, now, env) || await windowKilled(tx, c) || !await activeAccount(tx, c.accountId)) return false;
      if (await tx.frlPilotDeletion.count({ where: { account_id: c.accountId, state: { not: "verified" }, due_at: { lte: new Date(now) } } })) return false;
      if (!approvePilot(s, actorId, now)) return false;
    } else endPilot(s, now, "operator_rejected");
    await tx.auditLog.create({ data: { account_id: c.accountId, actor_type: "user", actor_user_id: actorId, action: approve ? "frl_pilot.admit" : "frl_pilot.reject", category: "workflow", target_type: "FrlPilotRun", target_id: runId, metadata_json: { windowId: c.windowId, identity: "operator_attested_not_carrier_verified" } } });
    await persist(tx, c, s, old, now);
    return true;
  });
}
