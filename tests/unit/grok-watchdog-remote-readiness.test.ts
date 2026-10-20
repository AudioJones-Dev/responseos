import { generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { createServer, type Server } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { afterEach, expect, test, vi } from "vitest";
import { qualificationFixture } from "../qualificationFixture";
import { createWatchdogReadinessWriter, watchdogReady } from "@/lib/grok/watchdogReadiness";
import { createWatchdogReadinessServer } from "@/lib/grok/watchdogRemoteReadiness";
import { qualificationConfigHash } from "@/lib/grok/qualification";

const secret = "a7".repeat(32);
let fixture: ReturnType<typeof qualificationFixture> | undefined, server: Server | undefined;
let privateKey: KeyObject;
afterEach(async () => {
  server?.closeAllConnections();
  if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
  server = undefined; fixture?.cleanup(); fixture = undefined;
  vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks();
});
function setup() {
  fixture = qualificationFixture(); fixture.stopReadiness();
  vi.stubEnv("RESPONSEOS_GROK_WATCHDOG_READINESS_TRANSPORT", "signed-https");
  vi.stubEnv("RESPONSEOS_GROK_WATCHDOG_READINESS_URL", "https://watchdog.invalid/readiness");
  vi.stubEnv("RESPONSEOS_GROK_WATCHDOG_READINESS_KEY", secret);
  const keys = generateKeyPairSync("ed25519");
  privateKey = keys.privateKey;
  const signingFile = path.join(path.dirname(fixture.config), "synthetic-signing.pem");
  writeFileSync(signingFile, privateKey.export({ format: "pem", type: "pkcs8" }), { mode: 0o600 });
  vi.stubEnv("RESPONSEOS_GROK_WATCHDOG_READINESS_SIGNING_KEY_FILE", signingFile);
  vi.stubEnv("RESPONSEOS_GROK_WATCHDOG_READINESS_PUBLIC_KEY", keys.publicKey.export({ format: "der", type: "spki" }).toString("base64"));
  return createWatchdogReadinessWriter();
}
function signed(headers: Record<string, string>, change: object = {}, signingKey = secret) {
  const raw = JSON.stringify({
    version: 1, applicationSha: "a".repeat(40), controlSha: "b".repeat(40),
    instanceId: "synthetic-watchdog-instance", nonce: headers["x-watchdog-challenge"],
    ready: true, ageMs: 0, ...change,
  });
  return new Response(raw, { headers: {
    "content-type": "application/json",
    "x-watchdog-signature": sign(null, Buffer.from(`response-v1\n${raw}`),
      signingKey === secret ? privateKey : generateKeyPairSync("ed25519").privateKey).toString("base64"),
  } });
}
test("independent HTTP listener authenticates fresh challenges; loss, recovery, and restart remain fail closed", async () => {
  const writer = setup(), originalFetch = globalThis.fetch;
  server = createWatchdogReadinessServer();
  await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  const local = `http://127.0.0.1:${port}/readiness`;
  const intercepted = vi.fn((_url: unknown, options: RequestInit) => originalFetch(local, options));
  vi.stubGlobal("fetch", intercepted);
  expect(await watchdogReady()).toBe(false);
  writer.completed(true);
  expect(await watchdogReady()).toBe(true);
  expect(await watchdogReady()).toBe(true);
  expect(intercepted.mock.calls[1][1].headers).not.toEqual(intercepted.mock.calls[2][1].headers);
  expect((await originalFetch(local)).status).toBe(403);
  expect((await originalFetch(local, { headers: { "x-watchdog-challenge": "a".repeat(64), "x-watchdog-auth": "b".repeat(64) } })).status).toBe(403);
  writer.completed(false); expect(await watchdogReady()).toBe(false);
  writer.completed(true); expect(await watchdogReady()).toBe(true);
  createWatchdogReadinessWriter(); expect(await watchdogReady()).toBe(false);
});
test.each([
  { nonce: "b".repeat(64) }, { applicationSha: "c".repeat(40) }, { controlSha: "c".repeat(40) },
  { instanceId: "other-instance-identity" }, { ready: false }, { version: 2 },
  { ageMs: -1 }, { ageMs: 3000 }, { ageMs: "0" }, { ageMs: null },
])("rejects authenticated but invalid remote proof %j", async change => {
  setup(); vi.stubGlobal("fetch", vi.fn(async (_url, options) => signed(options.headers, change)));
  expect(await watchdogReady()).toBe(false);
});
test("wrong key, replay, malformed, oversize, redirects, and unavailable responses fail closed", async () => {
  setup();
  let retained: Response | undefined;
  vi.stubGlobal("fetch", vi.fn(async (_url, options) => {
    retained ??= signed(options.headers);
    return retained.clone();
  }));
  expect(await watchdogReady()).toBe(true);
  expect(await watchdogReady()).toBe(false);
  for (const response of [
    signed({ "x-watchdog-challenge": "a".repeat(64) }, {}, "b8".repeat(32)),
    new Response("{", { headers: { "content-type": "application/json" } }),
    new Response("x".repeat(1025), { headers: { "content-type": "application/json" } }),
    new Response(null, { status: 302 }), new Response(null, { status: 503 }),
  ]) {
    vi.stubGlobal("fetch", vi.fn(async () => response));
    expect(await watchdogReady()).toBe(false);
  }
  vi.stubGlobal("fetch", vi.fn(async () => { throw Error("synthetic network failure"); }));
  expect(await watchdogReady()).toBe(false);
});
test("a current exact-binding response signed by the wrong key is rejected", async () => {
  setup();
  vi.stubGlobal("fetch", vi.fn(async (_url, options) => signed(options.headers, {}, "b8".repeat(32))));
  expect(await watchdogReady()).toBe(false);
});
test("a stalled response body is aborted within the request budget", async () => {
  setup(); const originalFetch = globalThis.fetch;
  server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.write("{");
  });
  await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  vi.stubGlobal("fetch", vi.fn((_url, options) => originalFetch(`http://127.0.0.1:${port}/readiness`, options)));
  const started = performance.now();
  expect(await watchdogReady()).toBe(false);
  expect(performance.now() - started).toBeLessThan(1500);
});
test("round trip consumes freshness, and remote timestamps do not depend on the reader clock", async () => {
  setup();
  let at = 100;
  vi.spyOn(performance, "now").mockImplementation(() => at);
  vi.stubGlobal("fetch", vi.fn(async (_url, options) => { at = 102; return signed(options.headers, { ageMs: 2999 }); }));
  expect(await watchdogReady()).toBe(false);
  at = 100;
  vi.stubGlobal("fetch", vi.fn(async (_url, options) => signed(options.headers, { ageMs: 100 })));
  expect(await watchdogReady(-1000000)).toBe(true);
  at = 3000;
  vi.stubGlobal("fetch", vi.fn(async (_url, options) => { at += 500; return signed(options.headers); }));
  expect(await watchdogReady()).toBe(false);
});
test.each(["http://watchdog.invalid/readiness", "https://user:password@watchdog.invalid/readiness", "https://watchdog.invalid/readiness?x=1", "https://watchdog.invalid/other"])("untrusted endpoint form %s makes no request", async url => {
  setup(); vi.stubEnv("RESPONSEOS_GROK_WATCHDOG_READINESS_URL", url);
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  expect(await watchdogReady()).toBe(false); expect(fetch).not.toHaveBeenCalled();
});
test.each(["inactive", "unknown"])("mode %s never starts a readiness request", async mode => {
  setup(); vi.stubEnv("RESPONSEOS_GROK_WATCHDOG_MODE", mode);
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  expect(await watchdogReady()).toBe(false); expect(fetch).not.toHaveBeenCalled();
});
test("missing key or unknown transport cannot fall back to a fresh file", async () => {
  const writer = setup(); writer.completed(true);
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  vi.stubEnv("RESPONSEOS_GROK_WATCHDOG_READINESS_KEY", undefined);
  expect(await watchdogReady()).toBe(false);
  vi.stubEnv("RESPONSEOS_GROK_WATCHDOG_READINESS_TRANSPORT", "unknown");
  expect(await watchdogReady()).toBe(false); expect(fetch).not.toHaveBeenCalled();
});
test("remote consumer needs neither the watchdog filesystem nor its private signing key", async () => {
  setup();
  const originalFetch = globalThis.fetch;
  const child = spawn(process.execPath, ["--import", "tsx", "tests/fixtures/watchdog-readiness-peer.ts"], {
    env: { ...process.env }, stdio: ["ignore", "pipe", "ignore", "ipc"],
  });
  const exited = once(child, "exit");
  try {
    const [message] = await Promise.race([
      once(child, "message"),
      exited.then(() => { throw Error("synthetic_peer_exited"); }),
      new Promise<never>((_, reject) => { const timer = setTimeout(() => reject(Error("synthetic_peer_timeout")), 3000); timer.unref(); }),
    ]);
    const before = qualificationConfigHash();
    vi.stubEnv("RESPONSEOS_GROK_WATCHDOG_READINESS_FILE", undefined);
    vi.stubEnv("RESPONSEOS_GROK_WATCHDOG_READINESS_SIGNING_KEY_FILE", undefined);
    vi.stubEnv("PORT", "10000");
    expect(qualificationConfigHash()).toBe(before);
    vi.stubGlobal("fetch", vi.fn((_url, options) => originalFetch(`http://127.0.0.1:${message.port}/readiness`, options)));
    expect(await watchdogReady()).toBe(true);
    child.kill("SIGKILL"); await exited;
    expect(await watchdogReady()).toBe(true);
    vi.spyOn(performance, "now").mockReturnValue(performance.now() + 3000);
    expect(await watchdogReady()).toBe(false);
  } finally {
    if (child.exitCode === null && child.signalCode === null) { child.kill("SIGKILL"); await exited; }
  }
});

test("transport failure uses only the original monotonic deadline, never a new grace period", async () => {
  setup(); let at = 100;
  vi.spyOn(performance, "now").mockImplementation(() => at);
  vi.stubGlobal("fetch", vi.fn(async (_url, options) => signed(options.headers, { ageMs: 1000 })));
  expect(await watchdogReady()).toBe(true);
  vi.stubGlobal("fetch", vi.fn(async () => { at += 100; throw Error("offline"); }));
  at = 1900; expect(await watchdogReady()).toBe(true);
  at = 2000; expect(await watchdogReady()).toBe(false);
  at = 3000; expect(await watchdogReady()).toBe(false);
});
test.each([503, 403, 302])("explicit response %s immediately revokes retained proof", async status => {
  setup();
  vi.stubGlobal("fetch", vi.fn(async (_url, options) => signed(options.headers)));
  expect(await watchdogReady()).toBe(true);
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status })));
  expect(await watchdogReady()).toBe(false);
  vi.stubGlobal("fetch", vi.fn(async () => { throw Error("offline"); }));
  expect(await watchdogReady()).toBe(false);
});
test("invalid signature revokes prior proof even if transport later fails", async () => {
  setup();
  vi.stubGlobal("fetch", vi.fn(async (_url, options) => signed(options.headers)));
  expect(await watchdogReady()).toBe(true);
  vi.stubGlobal("fetch", vi.fn(async (_url, options) => signed(options.headers, {}, "wrong")));
  expect(await watchdogReady()).toBe(false);
  vi.stubGlobal("fetch", vi.fn(async () => { throw Error("offline"); }));
  expect(await watchdogReady()).toBe(false);
});
test.each(["RESPONSEOS_APPLICATION_SHA", "RESPONSEOS_CONTROL_SHA", "RESPONSEOS_GROK_WATCHDOG_INSTANCE",
  "RESPONSEOS_GROK_WATCHDOG_READINESS_KEY", "RESPONSEOS_GROK_WATCHDOG_READINESS_PUBLIC_KEY",
  "RESPONSEOS_GROK_WATCHDOG_READINESS_URL", "RESPONSEOS_QUALIFICATION_SHA256"])("changed %s cannot inherit proof", async name => {
  setup();
  vi.stubGlobal("fetch", vi.fn(async (_url, options) => signed(options.headers)));
  expect(await watchdogReady()).toBe(true);
  vi.stubEnv(name, name.endsWith("URL") ? "https://other.invalid/readiness" : "c".repeat(64));
  vi.stubGlobal("fetch", vi.fn(async () => { throw Error("offline"); }));
  expect(await watchdogReady()).toBe(false);
});
test("concurrent requests share one challenge; denial cannot race with an older success", async () => {
  setup(); let finish!: (response: Response) => void;
  const fetch = vi.fn(() => new Promise<Response>(resolve => { finish = resolve; }));
  vi.stubGlobal("fetch", fetch);
  const a = watchdogReady(), b = watchdogReady();
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  finish(new Response(null, { status: 503 }));
  expect(await Promise.all([a, b])).toEqual([false, false]);
});
test("a late request for a replaced binding cannot restore its old proof", async () => {
  setup(); let finish!: (response: Response) => void;
  let headers!: Record<string, string>;
  vi.stubGlobal("fetch", vi.fn((_url, options) => { headers = options.headers; return new Promise<Response>(resolve => { finish = resolve; }); }));
  const pending = watchdogReady();
  await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
  vi.stubEnv("RESPONSEOS_GROK_WATCHDOG_READINESS_URL", "https://other.invalid/readiness");
  vi.stubGlobal("fetch", vi.fn(async () => { throw Error("offline"); }));
  expect(await watchdogReady()).toBe(false);
  finish(signed(headers));
  expect(await pending).toBe(false);
});
test("only the writer-owned sweep uses local proof and never leaks that scope to consumers", async () => {
  const writer = setup(); writer.completed(true);
  const fetch = vi.fn(async () => { throw Error("public edge unavailable"); });
  vi.stubGlobal("fetch", fetch);
  await writer.sweep(async () => {
    await Promise.resolve();
    expect(await watchdogReady()).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
    writer.clear();
    expect(await watchdogReady()).toBe(false);
    writer.completed(true);
  });
  expect(await watchdogReady()).toBe(false);
  expect(fetch).toHaveBeenCalledTimes(1);
});
test("changing the pinned signer denies proof and changes qualification identity", async () => {
  setup(); const before = qualificationConfigHash();
  vi.stubGlobal("fetch", vi.fn(async (_url, options) => signed(options.headers)));
  vi.stubEnv("RESPONSEOS_GROK_WATCHDOG_READINESS_PUBLIC_KEY",
    generateKeyPairSync("ed25519").publicKey.export({ format: "der", type: "spki" }).toString("base64"));
  expect(await watchdogReady()).toBe(false);
  expect(qualificationConfigHash()).not.toBe(before);
  expect(() => createWatchdogReadinessServer()).toThrow("signer_mismatch");
});
