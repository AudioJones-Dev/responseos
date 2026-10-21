import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { vi } from "vitest";
import { qualificationConfigHash, qualificationHash, type Qualification } from "@/lib/grok/qualification";
import { createWatchdogReadinessWriter } from "@/lib/grok/watchdogReadiness";

export function qualificationFixture(overrides: Record<string, unknown> = {}) {
  const directory = mkdtempSync(path.join(tmpdir(), "qualification-test-"));
  const file = path.join(directory, "authority.json"), config = path.join(directory, "listener.json");
  const listener = { mode: "production", ingress: "managed-edge-http", streamUrl: "wss://synthetic.invalid/media", publicKey: "synthetic-public-key" };
  writeFileSync(config, JSON.stringify(listener));
  for (const [name, value] of Object.entries({
    RESPONSEOS_LIVE_HUBSPOT_ENABLED: "false", RESPONSEOS_LIVE_EMAIL_ENABLED: "false", RESPONSEOS_REQUIRE_AUTH: "true", RESPONSEOS_QUALIFICATION_ACTIVATION: "ENABLED", RESPONSEOS_QUALIFICATION_FILE: file,
    RESPONSEOS_APPLICATION_SHA: "a".repeat(40), RESPONSEOS_CONTROL_SHA: "b".repeat(40),
    RESPONSEOS_VOICE_ENGINE: "grok-voice-3.0", RESPONSEOS_GROK_STREAM_URL: listener.streamUrl,
    TELNYX_PUBLIC_KEY: listener.publicKey, RESPONSEOS_GROK_MEDIA_CONFIG: config, PORT: "9000",
    RESPONSEOS_QUALIFICATION_TELNYX_ACCOUNT: "synthetic-telnyx", RESPONSEOS_QUALIFICATION_CONNECTION: "synthetic-connection",
    RESPONSEOS_QUALIFICATION_XAI_TEAM: "synthetic-team", RESPONSEOS_QUALIFICATION_XAI_PROJECT: "synthetic-project",
    TELNYX_API_KEY: "synthetic-carrier-key", XAI_API_KEY: "synthetic-xai-key",
    RESPONSEOS_GROK_WATCHDOG_MODE: "active", RESPONSEOS_GROK_WATCHDOG_ENABLED: "true",
    RESPONSEOS_GROK_WATCHDOG_READINESS_FILE: path.join(directory, "watchdog.json"),
    RESPONSEOS_GROK_WATCHDOG_INSTANCE: "synthetic-watchdog-instance",
  })) vi.stubEnv(name, value);
  const readiness = createWatchdogReadinessWriter();
  readiness.completed(true);
  const timer = setInterval(() => readiness.completed(true), 500);
  timer.unref();
  const policy = { version: 1, mode: "carrier-qualification", enabled: true, authorityId: "synthetic-only", applicationSha: "a".repeat(40), controlSha: "b".repeat(40), configSha256: qualificationConfigHash(), accountId: "synthetic-demo", assignmentId: "synthetic-assignment", numberId: "synthetic-number", providerNumberId: "synthetic-provider-number", e164: "+15555550188", telnyxAccountId: "synthetic-telnyx", connectionId: "synthetic-connection", xaiTeamId: "synthetic-team", xaiProjectId: "synthetic-project", telnyxKeySha256: qualificationHash("synthetic-carrier-key"), xaiKeySha256: qualificationHash("synthetic-xai-key"), notBefore: new Date(Date.now() - 1000).toISOString(), expiresAt: new Date(Date.now() + 60000).toISOString(), maxConcurrentCalls: 1, maxDurationMs: 30000, actions: ["streaming_start", "realtime_audio", "hangup"], crm: false, email: false, recording: false, automaticTransfer: false, ...overrides } as Qualification;
  function save(value: unknown = policy) { const bytes = JSON.stringify(value); writeFileSync(file, bytes); vi.stubEnv("RESPONSEOS_QUALIFICATION_SHA256", qualificationHash(bytes)); }
  save();
  return { policy, save, config, stopReadiness: () => { clearInterval(timer); readiness.clear(); }, cleanup: () => { clearInterval(timer); rmSync(directory, { recursive: true }); } };
}
