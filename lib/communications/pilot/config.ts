import "@/lib/serverOnlyGuard";
import { createHash } from "node:crypto";
import { z } from "zod";

const phone = z.string().regex(/^\+1[2-9]\d{9}$/);
const approval = z.string().min(1).max(200);
const duration = z.object({ mode: z.literal("application_watchdog"), riskApprovalRef: approval }).strict();
const base = z.object({
  version: z.literal("FRL-PILOT-001"), mode: z.literal("SUPERVISED_PILOT"),
  admission: z.literal("manual"),
  accountId: z.string().min(1).max(200), applicationId: z.string().min(1).max(200),
  deploymentId: z.string().min(1).max(200), databaseTargetDigest: z.string().regex(/^[a-f0-9]{64}$/),
  number: phone, operator: phone, callers: z.array(phone).max(10),
  windowId: z.string().uuid(), opensAt: z.iso.datetime(), closesAt: z.iso.datetime(),
  disclosureVersion: z.literal("frl-recorded-v1"),
  retentionApprovalRef: approval, retentionHours: z.literal(24),
  providerCaptureDefaultsOff: z.literal(true),
  providerRoutingLimitsVerified: z.literal(true),
  maxCalls: z.number().int().min(1).max(6),
}).strict();
export const pilotConfigSchema = z.discriminatedUnion("exercise", [
  base.extend({
    exercise: z.literal("recorded"), legalApprovalRef: approval,
    disclosureVersion: z.enum(["frl-recorded-v1", "frl-spoken-v2"]),
    speech: z.object({ transientControlsApprovalRef: approval, wordingApprovalRef: approval, processingApprovalRef: approval, retentionVerified: z.literal(true), withdrawalVerified: z.literal(true) }).strict().optional(),
    independentEndpointVerified: z.literal(true), providerRetentionVerified: z.literal(true),
    durationPolicy: duration.extend({ independentWatchdogVerified: z.literal(true), manualStopVerified: z.literal(true) }).strict(),
  }).strict(),
  base.extend({
    exercise: z.literal("keypad"), admission: z.enum(["manual", "automatic_once"]), durationPolicy: duration,
    commissioning: z.object({ approvalRef: approval, operatorPresent: z.literal(true), manualProviderStopAvailable: z.literal(true), watchdogInventoryVerified: z.literal(true), capture: z.literal("off"), operatorDial: z.literal("off") }).strict(),
  }).strict(),
]).refine(c => c.exercise !== "recorded" || (c.disclosureVersion === "frl-spoken-v2") === !!c.speech, "speech_disclosure_and_evidence_required")
  .refine(c => c.number !== c.operator && !c.callers.includes(c.number) && !c.callers.includes(c.operator), "loop_or_shared_endpoint")
  .refine(c => Date.parse(c.closesAt) > Date.parse(c.opensAt) && Date.parse(c.closesAt) - Date.parse(c.opensAt) <= 1800000, "window_max_thirty_minutes")
  .refine(c => c.admission !== "automatic_once" || c.maxCalls === 1 && Date.parse(c.closesAt) - Date.parse(c.opensAt) <= 300000, "automatic_once_requires_one_call_and_five_minutes");
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
