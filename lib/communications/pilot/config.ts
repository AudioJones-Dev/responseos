import "@/lib/serverOnlyGuard";
import { createHash } from "node:crypto";
import { z } from "zod";

const phone = z.string().regex(/^\+1[2-9]\d{9}$/);
export const pilotConfigSchema = z.object({
  version: z.literal("FRL-PILOT-001"), mode: z.literal("SUPERVISED_PILOT"),
  admission: z.literal("manual"), exercise: z.enum(["keypad", "recorded"]),
  accountId: z.string().min(1).max(200), applicationId: z.string().min(1).max(200),
  deploymentId: z.string().min(1).max(200), databaseTargetDigest: z.string().regex(/^[a-f0-9]{64}$/),
  number: phone, operator: phone, callers: z.array(phone).max(10),
  windowId: z.string().uuid(), opensAt: z.iso.datetime(), closesAt: z.iso.datetime(),
  disclosureVersion: z.literal("frl-recorded-v1"), legalApprovalRef: z.string().min(1).max(200),
  retentionApprovalRef: z.string().min(1).max(200), retentionHours: z.literal(24),
  independentEndpointVerified: z.literal(true), providerCaptureDefaultsOff: z.literal(true),
  providerRoutingLimitsVerified: z.literal(true),
  durationPolicy: z.object({ mode: z.literal("application_watchdog"), riskApprovalRef: z.string().min(1).max(200), independentWatchdogVerified: z.literal(true), manualStopVerified: z.literal(true) }).strict(),
  providerRetentionVerified: z.literal(true), maxCalls: z.number().int().min(1).max(6),
}).strict().refine(c => c.number !== c.operator && !c.callers.includes(c.number) && !c.callers.includes(c.operator), "loop_or_shared_endpoint")
  .refine(c => Date.parse(c.closesAt) > Date.parse(c.opensAt) && Date.parse(c.closesAt) - Date.parse(c.opensAt) <= 1800000, "window_max_thirty_minutes");
export type PilotConfig = z.infer<typeof pilotConfigSchema>;

export function loadPilotConfig(env: Record<string, string | undefined> = process.env): PilotConfig | null {
  try { return pilotConfigSchema.parse(JSON.parse(env.RESPONSEOS_FRL_PILOT_CONFIG ?? "null")); }
  catch { return null; }
}
export function configDigest(c: PilotConfig): string {
  return createHash("sha256").update(JSON.stringify(c)).digest("hex");
}
export function databaseTargetDigest(url: string | undefined): string | null {
  try {
    const parsed = new URL(url ?? "");
    if (!["postgres:", "postgresql:"].includes(parsed.protocol)) return null;
    return createHash("sha256").update(JSON.stringify([parsed.hostname, parsed.port || "5432", parsed.pathname])).digest("hex");
  } catch { return null; }
}
export function pilotOpen(c: PilotConfig, now: number, env: Record<string, string | undefined> = process.env): boolean {
  return env.RESPONSEOS_FRL_PILOT_ENABLED === "true" && env.RESPONSEOS_FRL_PILOT_KILL !== "true" &&
    env.RESPONSEOS_REQUIRE_AUTH === "true" &&
    env.VERCEL_ENV !== "production" && env.RESPONSEOS_FRL_PILOT_DEPLOYMENT_ID === c.deploymentId &&
    databaseTargetDigest(env.DATABASE_URL) === c.databaseTargetDigest && c.number !== env.RESPONSEOS_DEMO_PHONE_E164 &&
    now >= Date.parse(c.opensAt) && now < Date.parse(c.closesAt);
}
