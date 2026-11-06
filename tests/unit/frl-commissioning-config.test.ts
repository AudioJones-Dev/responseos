import { expect, test } from "vitest";
import { configDigest, pilotConfigSchema, pilotOpen } from "@/lib/communications/pilot/config";
import { pilotRequest } from "@/lib/providers/telnyx/pilot";
import { type Intent } from "@/lib/communications/pilot/machine";
import { machineHarness, pilotNow, testAutomaticConfig, testKeypadConfig, testPilotConfig } from "../fixtures/frl-pilot";

test("automatic commissioning is one keypad call within five minutes only", () => {
  const c = testAutomaticConfig();
  expect(pilotConfigSchema.parse(c)).toEqual(c);
  expect(pilotConfigSchema.safeParse({ ...c, maxCalls: 2 }).success).toBe(false);
  expect(pilotConfigSchema.safeParse({ ...c, closesAt: new Date(Date.parse(c.opensAt) + 300001).toISOString() }).success).toBe(false);
  expect(pilotConfigSchema.safeParse({ ...testPilotConfig(), admission: "automatic_once", maxCalls: 1 }).success).toBe(false);
});

test("keypad config requires commissioning evidence without claiming recorded qualification", () => {
  const c = testKeypadConfig();
  expect(pilotConfigSchema.parse(c)).toEqual(c);
  for (const field of ["legalApprovalRef", "providerRetentionVerified", "independentEndpointVerified"]) {
    expect(c).not.toHaveProperty(field);
    expect(pilotConfigSchema.safeParse({ ...c, [field]: true }).success).toBe(false);
  }
  expect(pilotConfigSchema.safeParse({ ...c, commissioning: undefined }).success).toBe(false);
  if (c.exercise !== "keypad") throw new Error("fixture");
  for (const field of ["operatorPresent", "manualProviderStopAvailable", "watchdogInventoryVerified"]) {
    expect(pilotConfigSchema.safeParse({ ...c, commissioning: { ...c.commissioning, [field]: false } }).success).toBe(false);
  }
  expect(pilotConfigSchema.safeParse({ ...c, commissioning: { ...c.commissioning, capture: "on" } }).success).toBe(false);
});

test("changing exercise cannot promote commissioning evidence into recording permission", () => {
  const keypad = testKeypadConfig(), recorded = testPilotConfig();
  expect(pilotConfigSchema.safeParse({ ...keypad, exercise: "recorded" }).success).toBe(false);
  expect(pilotConfigSchema.safeParse({ ...recorded, exercise: "keypad" }).success).toBe(false);
  for (const field of ["legalApprovalRef", "providerRetentionVerified", "independentEndpointVerified"]) {
    expect(pilotConfigSchema.safeParse({ ...recorded, [field]: undefined }).success).toBe(false);
  }
  expect(pilotConfigSchema.safeParse({ ...recorded, durationPolicy: keypad.durationPolicy }).success).toBe(false);
  expect(configDigest(keypad)).not.toBe(configDigest(recorded));
});

test("keypad commissioning preserves deployment, time-window and kill gates", () => {
  const c = testKeypadConfig();
  const env = { RESPONSEOS_FRL_PILOT_ENABLED: "true", RESPONSEOS_REQUIRE_AUTH: "true", RESPONSEOS_FRL_PILOT_DEPLOYMENT_ID: "synthetic-pilot", DATABASE_URL: "postgresql://localhost/pilot" };
  expect(pilotOpen(c, pilotNow, env)).toBe(true);
  expect(pilotOpen(c, pilotNow, { ...env, RESPONSEOS_FRL_PILOT_KILL: "true" })).toBe(false);
  expect(pilotOpen(c, Date.parse(c.closesAt), env)).toBe(false);
  expect(pilotOpen(c, pilotNow, { ...env, RESPONSEOS_FRL_PILOT_DEPLOYMENT_ID: "other" })).toBe(false);
});

test.each(["dial", "bridge", "name", "conversation", "caller_consent", "operator_consent", "name_prompt", "hold", "unavailable"] as Intent["purpose"][])("keypad request boundary rejects %s even with recorded machine state", purpose => {
  const h = machineHarness();
  expect(() => pilotRequest(h.state, { id: "test", role: "caller", purpose, createdAt: pilotNow, deadline: pilotNow + 10000 }, testKeypadConfig(), pilotNow)).toThrow("keypad_command_denied");
});
