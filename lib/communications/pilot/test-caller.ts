import "@/lib/serverOnlyGuard";
import type { PrismaClient } from "@prisma/client";
import { pilotOpen, type PilotConfig } from "./config";

export const testCaller = {
  applicationId: "3087529317790386093",
  from: "+17543102582",
  to: "+17543180588",
  webhook: "https://responseos-frl-live-demo-frl-live-demo.vercel.app/api/webhooks/telnyx/test-caller",
} as const;

export function testCallerRequest(c: PilotConfig, now: number, env: Record<string, string | undefined>) {
  if (c.exercise !== "keypad" || c.admission !== "automatic_once" || c.maxCalls !== 1 ||
      c.number !== testCaller.to || c.applicationId === testCaller.applicationId ||
      c.operator === testCaller.from || !pilotOpen(c, now, env) ||
      env.RESPONSEOS_FRL_TEST_CALLER_WINDOW_ID !== c.windowId ||
      env.RESPONSEOS_FRL_PILOT_WORKER_ENABLED !== "true" ||
      Date.parse(c.closesAt) - now < 120000) throw new Error("test_caller_window_denied");
  return {
    connection_id: testCaller.applicationId, from: testCaller.from, to: testCaller.to,
    command_id: c.windowId, timeout_secs: 30, retry_on_timeout: false, time_limit_secs: 60,
    send_digits_on_answer: "W".repeat(20) + "1WW2WW*", transcription: false,
    webhook_url: testCaller.webhook, webhook_url_method: "POST",
  };
}

export async function claimTestCaller(db: Pick<PrismaClient, "$transaction">, c: PilotConfig, env: Record<string, string | undefined>) {
  return db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`frl-pilot:${c.accountId}`}, 0))`;
    const request = testCallerRequest(c, Date.now(), env);
    const rows = await tx.$queryRaw<{ allowed: boolean }[]>`SELECT ("status" = 'active' AND (to_jsonb(a)->>'setup_draft_json') IS NULL) AS allowed FROM "Account" a WHERE "id" = ${c.accountId} FOR SHARE`;
    if (!rows[0]?.allowed ||
        !await tx.auditLog.findFirst({ where: { account_id: c.accountId, action: "frl_pilot.arm", target_id: c.windowId } }) ||
        await tx.auditLog.findFirst({ where: { account_id: c.accountId, action: "frl_pilot.kill", target_id: c.windowId } }) ||
        await tx.frlPilotRun.count({ where: { account_id: c.accountId, OR: [{ closed: false }, { window_id: c.windowId }] } }) ||
        await tx.frlPilotDeletion.count({ where: { account_id: c.accountId, state: { not: "verified" } } })) throw new Error("test_caller_state_denied");
    // Commit the single-use claim before network I/O. Uncertain requests consume the window.
    await tx.auditLog.create({ data: { id: `frl-test-caller:${c.windowId}`, account_id: c.accountId,
      actor_type: "system", category: "workflow", action: "frl_pilot.test_caller_claim",
      target_type: "FrlPilotWindow", target_id: c.windowId,
      metadata_json: { capture: "off", outcome: "dispatch_claimed", applicationId: testCaller.applicationId } } });
    return request;
  });
}
