import { generateKeyPairSync, sign } from "node:crypto";
import { afterEach, expect, test, vi } from "vitest";
import { testCaller, testCallerRequest } from "@/lib/communications/pilot/test-caller";
import { testAutomaticConfig } from "../fixtures/frl-pilot";
import { POST } from "@/app/api/webhooks/telnyx/test-caller/route";

afterEach(() => vi.unstubAllEnvs());
test("the fixed caller cannot dial outside a bound capture-off window", () => {
  const now = Date.now(), c = { ...testAutomaticConfig(now), number: testCaller.to };
  const env = { RESPONSEOS_FRL_PILOT_ENABLED: "true", RESPONSEOS_REQUIRE_AUTH: "true", RESPONSEOS_FRL_PILOT_DEPLOYMENT_ID: c.deploymentId,
    DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://localhost/pilot", RESPONSEOS_FRL_TEST_CALLER_WINDOW_ID: c.windowId, RESPONSEOS_FRL_PILOT_WORKER_ENABLED: "true" };
  const request = testCallerRequest(c, now, env);
  expect(request).toMatchObject({ from: testCaller.from, to: testCaller.to, command_id: c.windowId, time_limit_secs: 60, retry_on_timeout: false, transcription: false });
  expect(request).not.toHaveProperty("record");
  expect(request.send_digits_on_answer.replace(/W/g, "")).toBe("12*");
  for (const bad of [{ ...env, VERCEL_ENV: "production" }, { ...env, RESPONSEOS_FRL_PILOT_KILL: "true" }, { ...env, RESPONSEOS_FRL_TEST_CALLER_WINDOW_ID: "old" }]) expect(() => testCallerRequest(c, now, bad)).toThrow();
  expect(() => testCallerRequest({ ...c, number: c.operator }, now, env)).toThrow();
  expect(() => testCallerRequest(c, Date.parse(c.closesAt) - 119999, env)).toThrow();
});

test("callback sink checks signature and exact application endpoints, without returning tokens", async () => {
  vi.stubEnv("VERCEL_ENV", "preview"); vi.stubEnv("RESPONSEOS_REQUIRE_AUTH", "true"); vi.stubEnv("RESPONSEOS_LIVE_TELNYX_INGEST_ENABLED", "true");
  const keys = generateKeyPairSync("ed25519");
  vi.stubEnv("TELNYX_PUBLIC_KEY", keys.publicKey.export({ type: "spki", format: "pem" }).toString());
  async function send(patch = {}, signed = true, age = 0) {
    const raw = JSON.stringify({ data: { id: "synthetic", event_type: "call.answered", payload: { connection_id: testCaller.applicationId, from: testCaller.from, to: testCaller.to, call_control_id: "secret-control", ...patch } } });
    const stamp = String(Math.floor(Date.now() / 1000) - age);
    return POST(new Request("https://example.test", { method: "POST", body: raw, headers: signed ? {
      "telnyx-timestamp": stamp, "telnyx-signature-ed25519": sign(null, Buffer.from(`${stamp}|${raw}`), keys.privateKey).toString("base64"),
    } : {} }));
  }
  const ok = await send(); expect(ok.status).toBe(204); expect(await ok.text()).toBe("");
  expect((await send({}, false)).status).toBe(401);
  expect((await send({}, true, 301)).status).toBe(401);
  expect((await send({ connection_id: "foreign" })).status).toBe(422);
  expect((await send({ to: "+13055550123" })).status).toBe(422);
  vi.stubEnv("VERCEL_ENV", "production"); expect((await send()).status).toBe(503);
});
