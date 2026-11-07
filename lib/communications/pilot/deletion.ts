import "@/lib/serverOnlyGuard";
import type { FrlPilotDeletion, PrismaClient } from "@prisma/client";
import { z } from "zod";
import type { PilotState } from "./machine";

import { deleteSpeechConversation } from "./speech";

export type DeletionResult = "verified" | "retry" | "identity_mismatch";
export type DeletionTransport = (task: FrlPilotDeletion) => Promise<DeletionResult>;

export function telnyxDeletionTransport(key: string, applicationId: string): DeletionTransport {
  const request = (path: string, method = "GET") => fetch(`https://api.telnyx.com/v2${path}`, {
    method, headers: { Authorization: `Bearer ${key}` }, redirect: "error", signal: AbortSignal.timeout(5000),
  });
  const remove = async (path: string): Promise<boolean> => {
    const result = await request(path, "DELETE");
    if (!result.ok && result.status !== 404) return false;
    return (await request(path)).status === 404;
  };
  return async task => {
    try {
      if (task.kind === "conversation") {
        if (!task.call_control_id || !task.call_leg_id || !task.call_session_id || task.recording_id !== null) return "identity_mismatch";
        return deleteSpeechConversation({ accountId: task.account_id, applicationId, runId: task.run_id, commandId: task.id,
          role: "caller", leg: { controlId: task.call_control_id, legId: task.call_leg_id, sessionId: task.call_session_id },
          disclosure: "frl-spoken-v2", issuedAt: 0, expiresAt: 0, conversationId: task.resource_id }, task.account_id, key);
      }
      if (!task.recording_id) return "identity_mismatch";
      if (task.kind === "transcription") {
        const path = `/recording_transcriptions/${encodeURIComponent(task.resource_id)}`;
        const found = await request(path);
        if (found.status === 404) return "verified";
        if (!found.ok) return "retry";
        const data = z.object({ data: z.object({ id: z.string(), recording_id: z.string() }) }).safeParse(await found.json());
        if (!data.success || data.data.data.id !== task.resource_id || data.data.data.recording_id !== task.recording_id) return "identity_mismatch";
        return await remove(path) ? "verified" : "retry";
      }
      if (task.kind !== "recording" || task.resource_id !== task.recording_id) return "identity_mismatch";
      const path = `/recordings/${encodeURIComponent(task.recording_id)}`;
      const found = await request(path);
      if (found.status !== 404) {
        if (!found.ok) return "retry";
        const data = z.object({ data: z.object({ id: z.string(), connection_id: z.string() }) }).safeParse(await found.json());
        if (!data.success || data.data.data.id !== task.recording_id || data.data.data.connection_id !== applicationId) return "identity_mismatch";
      }
      // Re-list the first page after each deletion so page shifts cannot skip transcripts.
      for (let page = 0; page < 10; page++) {
        const list = await request(`/recording_transcriptions?filter[recording_id]=${encodeURIComponent(task.recording_id)}&page[size]=100`);
        if (!list.ok) return "retry";
        const parsed = z.object({ data: z.array(z.object({ id: z.string().uuid(), recording_id: z.string() })) }).safeParse(await list.json());
        if (!parsed.success) return "retry";
        if (!parsed.data.data.length) return await remove(path) ? "verified" : "retry";
        for (const t of parsed.data.data) {
          if (t.recording_id !== task.recording_id) return "identity_mismatch";
          if (!await remove(`/recording_transcriptions/${encodeURIComponent(t.id)}`)) return "retry";
        }
      }
      return "retry";
    } catch { return "retry"; }
  };
}

export async function deletePilotArtifacts(db: Pick<PrismaClient, "$transaction">, accountId: string, transport: DeletionTransport, now = Date.now()) {
  return db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`frl-pilot-deletion:${accountId}`}, 0))`;
    const task = await tx.frlPilotDeletion.findFirst({ where: { account_id: accountId, state: { not: "verified" }, due_at: { lte: new Date(now) }, next_attempt_at: { lte: new Date(now) } }, orderBy: { due_at: "asc" } });
    if (!task) return false;
    const run = await tx.frlPilotRun.findFirst({ where: { id: task.run_id, account_id: accountId }, select: { state_json: true, expires_at: true } });
    const observing = (run?.state_json as unknown as PilotState | undefined)?.qualification === true && now < run!.expires_at.getTime();
    const result = await transport(task);
    const attempts = task.attempts + 1;
    await tx.frlPilotDeletion.update({ where: { account_id: accountId, id: task.id }, data: {
      attempts, state: result === "verified" ? observing ? "observing" : "verified" : "retry", last_error: result === "verified" ? null : result,
      verified_at: result === "verified" ? new Date(now) : null,
      next_attempt_at: new Date(result === "verified" && observing ? Math.min(now + 300000, run!.expires_at.getTime()) : now + Math.min(300000, 1000 * 2 ** Math.min(attempts, 8))),
    } });
    await tx.auditLog.create({ data: { account_id: accountId, actor_type: "system", category: "workflow", action: `frl_pilot.deletion_${result}`, target_type: "FrlPilotDeletion", target_id: task.id, metadata_json: { kind: task.kind, attempts, observationContinues: result === "verified" && observing } } });
    return true;
  }, { timeout: 120000, maxWait: 1000 });
}
