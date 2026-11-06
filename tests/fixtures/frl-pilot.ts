import { randomUUID } from "node:crypto";
import { databaseTargetDigest, type PilotConfig } from "@/lib/communications/pilot/config";
import { initialPilot, latest, observePilot, type Observation, type PilotState, type Role } from "@/lib/communications/pilot/machine";

export const pilotNow = Date.parse("2026-11-06T16:00:00Z");
export const callerLeg = { controlId: "caller-control", legId: "caller-leg", sessionId: "session" };
export const operatorLeg = { controlId: "operator-control", legId: "operator-leg", sessionId: "session" };
export function testPilotConfig(now = pilotNow): PilotConfig {
  return { version: "FRL-PILOT-001", mode: "SUPERVISED_PILOT", accountId: "pilot-account", applicationId: "pilot-application",
    admission: "manual", exercise: "recorded",
    deploymentId: "synthetic-pilot", databaseTargetDigest: databaseTargetDigest(process.env.DATABASE_URL ?? "postgresql://localhost/pilot")!,
    number: "+13055550101", operator: "+13055550102", callers: ["+13055550103"], windowId: randomUUID(),
    opensAt: new Date(now - 1000).toISOString(), closesAt: new Date(now + 360000).toISOString(), disclosureVersion: "frl-recorded-v1",
    legalApprovalRef: "synthetic-only", retentionApprovalRef: "synthetic-only", retentionHours: 24,
    independentEndpointVerified: true, providerCaptureDefaultsOff: true, providerRoutingLimitsVerified: true,
    durationPolicy: { mode: "application_watchdog", riskApprovalRef: "synthetic-only", independentWatchdogVerified: true, manualStopVerified: true }, providerRetentionVerified: true, maxCalls: 6 };
}
export function testKeypadConfig(now = pilotNow): PilotConfig {
  const c = testPilotConfig(now);
  if (c.exercise !== "recorded") throw new Error("recorded_fixture_required");
  const { legalApprovalRef: _legal, independentEndpointVerified: _endpoint, providerRetentionVerified: _retention, ...base } = c;
  void _legal; void _endpoint; void _retention;
  return { ...base, exercise: "keypad", durationPolicy: { mode: "application_watchdog", riskApprovalRef: "synthetic-only" },
    commissioning: { approvalRef: "synthetic-only", operatorPresent: true, manualProviderStopAvailable: true, watchdogInventoryVerified: true, capture: "off", operatorDial: "off" } };
}
export function testAutomaticConfig(now = pilotNow): PilotConfig {
  const c = testKeypadConfig(now);
  if (c.exercise !== "keypad") throw new Error("keypad_fixture_required");
  return { ...c, admission: "automatic_once", maxCalls: 1, closesAt: new Date(Date.parse(c.opensAt) + 300000).toISOString() };
}
export function machineHarness() {
  let now = pilotNow;
  let state = initialPilot(randomUUID(), callerLeg, now, now + 300000, "frl-recorded-v1");
  const send = (kind: Observation["kind"], role: Role = "caller", extra: Partial<Observation> = {}) => {
    now += 100;
    const token = kind === "bridged" && role === "operator" ? latest(state, "operator_consent")?.id : latest(state, state.stage === "ending" || state.stage === "ended" || state.stage === "pending" ? "conversation" : state.stage)?.id;
    state = observePilot(state, { id: randomUUID(), at: now, role, token, kind, ...extra } as Observation, now);
    return state;
  };
  return { get state() { return state; }, set state(s: PilotState) { state = s; }, get now() { return now; }, send,
    callerConsent(digit = "1") { send("answered"); send("consent", "caller", { digit, valid: true }); },
    nameSaved() { send("prompt_done"); const w = state.windows[0]; send("recording", "caller", { recordingId: randomUUID(), start: w.authorizedAt + 1, end: w.authorizedAt + 50, channels: "single" }); },
    operatorConsent(digit = "1") { send("prompt_done"); state.operator = operatorLeg; send("answered", "operator"); send("consent", "operator", { digit, valid: true }); },
    bridge() { send("bridged"); send("bridged", "operator"); },
  };
}
