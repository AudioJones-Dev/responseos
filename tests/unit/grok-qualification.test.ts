import { writeFileSync } from "node:fs";
import { afterEach, expect, test, vi } from "vitest";
import { qualificationFixture } from "../qualificationFixture";
import { readQualification } from "@/lib/grok/qualification";
let cleanup: (() => void) | undefined;
afterEach(() => { cleanup?.(); cleanup = undefined; vi.unstubAllEnvs(); });
test("default activation is disabled and a trusted synthetic policy binds exact identities", async () => {
  await expect(readQualification()).rejects.toThrow("unqualified");
  const f = qualificationFixture(); cleanup = f.cleanup;
  expect(readQualification()).toEqual(f.policy);
});
test.each([
  { enabled: false }, { mode: "unknown" }, { mode: undefined }, { maxConcurrentCalls: 2 }, { maxDurationMs: 300001 }, { maxDurationMs: 0 },
  { actions: ["hangup", "transfer"] }, { crm: true }, { email: true }, { recording: true }, { automaticTransfer: true }, { unexpected: true },
  { applicationSha: "c".repeat(40) }, { controlSha: "c".repeat(40) }, { configSha256: "c".repeat(64) }, { connectionId: "other" },
  { telnyxAccountId: "other" }, { xaiProjectId: "other" }, { xaiTeamId: "other" },
  { expiresAt: new Date(0).toISOString() }, { notBefore: new Date(Date.now() + 3600000).toISOString() }, { expiresAt: new Date(Date.now() + 7200000).toISOString() },
])("rejects malformed or mismatched authority %j", async change => {
  const f = qualificationFixture(); cleanup = f.cleanup; f.save({ ...f.policy, ...change });
  await expect(readQualification()).rejects.toThrow("unqualified");
});
test.each(["RESPONSEOS_QUALIFICATION_FILE", "RESPONSEOS_QUALIFICATION_SHA256", "RESPONSEOS_APPLICATION_SHA", "RESPONSEOS_CONTROL_SHA", "RESPONSEOS_QUALIFICATION_ACTIVATION", "RESPONSEOS_REQUIRE_AUTH", "RESPONSEOS_LIVE_HUBSPOT_ENABLED", "RESPONSEOS_LIVE_EMAIL_ENABLED"])("missing %s denies admission", async name => {
  const f = qualificationFixture(); cleanup = f.cleanup; vi.stubEnv(name, undefined);
  await expect(readQualification()).rejects.toThrow("unqualified");
});
test("config file edits and expiry are detected on every read", async () => {
  const f = qualificationFixture(); cleanup = f.cleanup;
  await expect(readQualification(new Date(f.policy.expiresAt))).rejects.toThrow("unqualified");
  writeFileSync(f.config, "{}"); await expect(readQualification()).rejects.toThrow("unqualified");
});

test.each(["RESPONSEOS_LIVE_HUBSPOT_ENABLED", "RESPONSEOS_LIVE_EMAIL_ENABLED"])("%s cannot be enabled during qualification", async name => { const f=qualificationFixture();cleanup=f.cleanup;vi.stubEnv(name,"true");await expect(readQualification()).rejects.toThrow("unqualified"); });
