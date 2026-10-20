import { createHmac } from "node:crypto";
import { createServer, type Server } from "node:http";
import { afterEach, expect, test, vi } from "vitest";
import { qualificationFixture } from "../qualificationFixture";
import { createWatchdogReadinessWriter, watchdogReady } from "@/lib/grok/watchdogReadiness";
import { createWatchdogReadinessServer } from "@/lib/grok/watchdogRemoteReadiness";

const secret = "a7".repeat(32);
let fixture: ReturnType<typeof qualificationFixture> | undefined, server: Server | undefined;
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
    "x-watchdog-signature": createHmac("sha256", Buffer.from(signingKey, "hex")).update(`response-v1\n${raw}`).digest("hex"),
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
  const clock = vi.spyOn(performance, "now");
  clock.mockReturnValueOnce(100).mockReturnValueOnce(102);
  vi.stubGlobal("fetch", vi.fn(async (_url, options) => signed(options.headers, { ageMs: 2999 })));
  expect(await watchdogReady()).toBe(false);
  clock.mockReturnValueOnce(100).mockReturnValueOnce(101);
  vi.stubGlobal("fetch", vi.fn(async (_url, options) => signed(options.headers, { ageMs: 100 })));
  expect(await watchdogReady(-1000000)).toBe(true);
  clock.mockReturnValueOnce(100).mockReturnValueOnce(600);
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
