import "@/lib/serverOnlyGuard";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { z } from "zod";
import type { GrokCallSession, Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { assertStoredWebhookIdentity } from "@/lib/data/webhookEvents";
import { parseCallControlEvent } from "@/lib/providers/telnyx/callControl";

const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const sha = z.string().regex(/^[0-9a-f]{64}$/);
export const qualificationSchema = z.object({
  version: z.literal(1), mode: z.literal("carrier-qualification"), enabled: z.literal(true),
  authorityId: id, applicationSha: z.string().regex(/^[0-9a-f]{40}$/), controlSha: z.string().regex(/^[0-9a-f]{40}$/), configSha256: sha,
  accountId: id, assignmentId: id, numberId: id, providerNumberId: id, e164: z.string().regex(/^\+[1-9][0-9]{7,14}$/),
  telnyxAccountId: id, connectionId: id, xaiTeamId: id, xaiProjectId: id,
  telnyxKeySha256: sha, xaiKeySha256: sha,
  notBefore: z.string().datetime(), expiresAt: z.string().datetime(),
  maxConcurrentCalls: z.literal(1), maxDurationMs: z.number().int().min(1000).max(300000),
  actions: z.tuple([z.literal("streaming_start"), z.literal("realtime_audio"), z.literal("hangup")]),
  crm: z.literal(false), email: z.literal(false), recording: z.literal(false), automaticTransfer: z.literal(false),
}).strict();
export type Qualification = z.infer<typeof qualificationSchema>;
export const qualificationHash = (value: string) => createHash("sha256").update(value).digest("hex");

export function qualificationConfigHash() {
  return qualificationHash(JSON.stringify([
    process.env.RESPONSEOS_VOICE_ENGINE, process.env.RESPONSEOS_GROK_STREAM_URL,
    process.env.TELNYX_PUBLIC_KEY, process.env.RESPONSEOS_GROK_MEDIA_CONFIG ? readFileSync(process.env.RESPONSEOS_GROK_MEDIA_CONFIG, "utf8") : null, process.env.PORT,
    process.env.RESPONSEOS_QUALIFICATION_TELNYX_ACCOUNT, process.env.RESPONSEOS_QUALIFICATION_CONNECTION,
    process.env.RESPONSEOS_QUALIFICATION_XAI_TEAM, process.env.RESPONSEOS_QUALIFICATION_XAI_PROJECT,
  ]));
}

export function readQualification(now = new Date()): Qualification {
  try {
    if (process.env.RESPONSEOS_QUALIFICATION_ACTIVATION !== "ENABLED" || process.env.RESPONSEOS_REQUIRE_AUTH !== "true") throw Error();
    const file = process.env.RESPONSEOS_QUALIFICATION_FILE, digest = process.env.RESPONSEOS_QUALIFICATION_SHA256;
    if (!file || !digest || !sha.safeParse(digest).success) throw Error();
    const bytes = readFileSync(file);
    if (bytes.length > 8192 || qualificationHash(bytes.toString("utf8")) !== digest) throw Error();
    if (!process.env.RESPONSEOS_GROK_MEDIA_CONFIG || !process.env.TELNYX_PUBLIC_KEY || !process.env.RESPONSEOS_GROK_STREAM_URL) throw Error();
    const listener = JSON.parse(readFileSync(process.env.RESPONSEOS_GROK_MEDIA_CONFIG, "utf8"));
    if (listener.mode !== "production" || listener.streamUrl !== process.env.RESPONSEOS_GROK_STREAM_URL || listener.publicKey !== process.env.TELNYX_PUBLIC_KEY) throw Error();
    const p = qualificationSchema.parse(JSON.parse(bytes.toString("utf8")));
    if (p.applicationSha !== process.env.RESPONSEOS_APPLICATION_SHA || p.controlSha !== process.env.RESPONSEOS_CONTROL_SHA || p.configSha256 !== qualificationConfigHash()
      || p.telnyxAccountId !== process.env.RESPONSEOS_QUALIFICATION_TELNYX_ACCOUNT || p.connectionId !== process.env.RESPONSEOS_QUALIFICATION_CONNECTION
      || p.xaiTeamId !== process.env.RESPONSEOS_QUALIFICATION_XAI_TEAM || p.xaiProjectId !== process.env.RESPONSEOS_QUALIFICATION_XAI_PROJECT
      || process.env.RESPONSEOS_VOICE_ENGINE !== "grok-voice-3.0"
      || Date.parse(p.notBefore) > now.getTime() || Date.parse(p.expiresAt) <= now.getTime()
      || Date.parse(p.expiresAt) - Date.parse(p.notBefore) > 3600000) throw Error();
    return p;
  } catch { throw Error("grok_provider_contract_unqualified"); }
}

export async function reserveQualification(tx: Prisma.TransactionClient, s: GrokCallSession, now: Date) {
  const p = readQualification(now);
  if (s.account_id !== p.accountId || s.assignment_id !== p.assignmentId) throw Error("qualification_target_mismatch");
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(194822, 1)`;
  const active = await tx.grokQualificationReservation.findFirst({ where: { active_slot: "qualification" }, include: { session: { include: { capture: true } } } });
  if (active) {
    if (!active.session.capture.call_disconnected_at) throw Error("qualification_call_in_progress");
    await tx.grokQualificationReservation.update({ where: { session_id: active.session_id }, data: { active_slot: null, released_at: now } });
  }
  const account = await tx.account.findUnique({ where: { id: p.accountId } });
  const assignment = await tx.telephonyNumberAssignment.findFirst({ where: { id: p.assignmentId, account_id: p.accountId, telephony_number_id: p.numberId, status: "qualification", unassigned_at: null } });
  const number = await tx.telephonyNumber.findFirst({ where: { id: p.numberId, provider: "telnyx", provider_number_id: p.providerNumberId, e164: p.e164, released_at: null, status: "assigned" } });
  const capture = await tx.callCaptureSession.findUniqueOrThrow({ where: { id: s.capture_id } });
  const event = await tx.webhookEvent.findUnique({ where: { provider_provider_event_id: { provider: "telnyx", provider_event_id: capture.dtmf_event_id! } } });
  if (!event) throw Error("qualification_proof_missing");
  const verified = await assertStoredWebhookIdentity(event.id, tx);
  const payload = parseCallControlEvent(verified.raw_body)?.data.payload;
  if (account?.account_type !== "internal_demo" || !assignment || assignment.number_exclusivity_key !== p.numberId || !number || await tx.telephonyNumberAssignment.count({ where: { telephony_number_id: p.numberId, unassigned_at: null } }) !== 1 || payload?.connection_id !== p.connectionId || payload.to !== p.e164) throw Error("qualification_provider_identity_mismatch");
  return tx.grokQualificationReservation.create({ data: { session_id: s.id, policy_json: p, policy_hash: qualificationHash(JSON.stringify(p)), admitted_at: now, deadline: new Date(Math.min(Date.parse(p.expiresAt), now.getTime() + p.maxDurationMs)), active_slot: "qualification" } });
}

export async function qualificationAlive(tx: Prisma.TransactionClient, s: GrokCallSession, now: Date) {
  const reservation = await tx.grokQualificationReservation.findUnique({ where: { session_id: s.id } });
  if (!reservation || reservation.released_at || reservation.deadline <= now) return false;
  try { return reservation.policy_hash === qualificationHash(JSON.stringify(readQualification(now))); } catch { return false; }
}

export async function authorizeQualificationTransport(action: "streaming_start" | "realtime_audio" | "hangup", resource?: string, commandId?: string) {
  if (action !== "hangup") readQualification();
  if (!db) throw Error("grok_provider_contract_unqualified");
  let p: Qualification;
  if (action === "hangup") {
    const command = await db.grokCallCommand.findUnique({ where: { id: commandId ?? "" }, include: { session: { include: { qualification: true } } } });
    const reservation = command?.session.qualification;
    if (!command || !reservation || command.kind !== "telnyx_hangup" || command.resource !== resource || command.session.provider_call_id !== resource || !command.session.stopped_at || !command.consumed_at || command.result_at || command.status !== "uncertain") throw Error("qualification_termination_unbound");
    p = qualificationSchema.parse(reservation.policy_json);
    if (qualificationHash(JSON.stringify(p)) !== reservation.policy_hash || p.accountId !== command.session.account_id || p.assignmentId !== command.session.assignment_id) throw Error("qualification_termination_unbound");
  } else {
    p = readQualification();
    if (action === "realtime_audio") {
      const session = await db.grokCallSession.findUnique({ where: { id: resource ?? "" } });
      if (!session || !session.worker_token || session.stopped_at || !await qualificationAlive(db as unknown as Prisma.TransactionClient, session, new Date())) throw Error("qualification_realtime_unbound");
    }
    if (action === "streaming_start") {
      const command = await db.grokCallCommand.findUnique({ where: { id: commandId ?? "" }, include: { session: true } });
      if (!command || command.kind !== "handoff" || command.resource !== resource || command.status !== "uncertain" || !command.consumed_at || command.result_at || command.session.stopped_at || !await qualificationAlive(db as unknown as Prisma.TransactionClient, command.session, new Date())) throw Error("qualification_start_unbound");
    }
  }
  const key = action === "realtime_audio" ? process.env.XAI_API_KEY : process.env.TELNYX_API_KEY;
  if (!key || qualificationHash(key) !== (action === "realtime_audio" ? p.xaiKeySha256 : p.telnyxKeySha256)) throw Error("qualification_credential_mismatch");
  return action === "realtime_audio" ? p.xaiKeySha256 : p.telnyxKeySha256;
}
