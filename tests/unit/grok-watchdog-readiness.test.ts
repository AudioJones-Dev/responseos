import { readFileSync, writeFileSync } from "node:fs";
import { afterEach, expect, test, vi } from "vitest";
import { qualificationFixture } from "../qualificationFixture";
import { readQualification } from "@/lib/grok/qualification";
import { createWatchdogReadinessWriter, watchdogReady, WATCHDOG_FRESHNESS_MS } from "@/lib/grok/watchdogReadiness";
import { runGrokWatchdog } from "@/lib/grok/watchdogLoop";
import { GET } from "@/app/api/health/route";

let fixture: ReturnType<typeof qualificationFixture> | undefined;
afterEach(() => { fixture?.cleanup(); fixture = undefined; vi.unstubAllEnvs(); vi.restoreAllMocks(); });
function setup() {
  fixture = qualificationFixture();
  fixture.stopReadiness();
  return createWatchdogReadinessWriter();
}
test.each([undefined, "", "inactive", "unknown"])("mode %s cannot qualify even with a recent proof", async mode => {
  const writer = setup(); writer.completed(true);
  vi.stubEnv("RESPONSEOS_GROK_WATCHDOG_MODE", mode);
  expect(await watchdogReady()).toBe(false);
  await expect(readQualification()).rejects.toThrow("unqualified");
});
test.each(["false", "", undefined])("enabled flag %s cannot qualify", async enabled => {
  const writer = setup(); writer.completed(true);
  vi.stubEnv("RESPONSEOS_GROK_WATCHDOG_ENABLED", enabled);
  expect(await watchdogReady()).toBe(false);
  await expect(readQualification()).rejects.toThrow("unqualified");
});
test.each([
  { mode: "inactive" }, { loop: false }, { applicationSha: "c".repeat(40) },
  { controlSha: "c".repeat(40) }, { instanceId: "other-instance-id" },
  { completedAt: "now" }, { completedAt: 0 },
])("rejects mismatched or invalid proof %j", async change => {
  const writer = setup(); writer.completed(true);
  const file = process.env.RESPONSEOS_GROK_WATCHDOG_READINESS_FILE!;
  const proof = JSON.parse(readFileSync(file, "utf8"));
  writeFileSync(file, JSON.stringify({ ...proof, ...change }));
  expect(await watchdogReady()).toBe(false);
  await expect(readQualification()).rejects.toThrow("unqualified");
});
test("freshness boundary, future timestamps, malformed/missing files fail closed", async () => {
  vi.spyOn(performance, "now").mockReturnValue(100);
  const writer = setup(); writer.completed(true);
  const file = process.env.RESPONSEOS_GROK_WATCHDOG_READINESS_FILE!;
  const proof = JSON.parse(readFileSync(file, "utf8"));
  expect(await watchdogReady(proof.completedAt)).toBe(true);
  expect(await watchdogReady(proof.completedAt + WATCHDOG_FRESHNESS_MS - 1)).toBe(true);
  expect(await watchdogReady(proof.completedAt + WATCHDOG_FRESHNESS_MS)).toBe(false);
  expect(await watchdogReady(proof.completedAt - 1)).toBe(false);
  writeFileSync(file, "{"); expect(await watchdogReady()).toBe(false);
  writer.clear(); expect(await watchdogReady()).toBe(false);
});
test("only a completed healthy sweep publishes readiness; failures and restart revoke it", async () => {
  const writer = setup();
  let finish!: (value: { inspected: number; failed: number }) => void;
  const pending = runGrokWatchdog({ loop: false, sweep: () => new Promise(resolve => { finish = resolve; }), pause: vi.fn(), alert: vi.fn(), completed: writer.completed });
  expect(await watchdogReady()).toBe(false);
  finish({ inspected: 0, failed: 0 }); await pending;
  expect(await watchdogReady()).toBe(true);
  for (const sweep of [async () => ({ inspected: 1, failed: 1 }), async () => { throw Error("synthetic_failure"); }]) {
    await runGrokWatchdog({ loop: false, sweep, pause: vi.fn(), alert: vi.fn(), completed: writer.completed });
    expect(await watchdogReady()).toBe(false);
    writer.completed(true);
  }
  createWatchdogReadinessWriter();
  expect(await watchdogReady()).toBe(false);
});
test("activation health is 503 without active sweep proof and 200 only while proof is fresh", async () => {
  const writer = setup();
  expect((await GET()).status).toBe(503);
  writer.completed(true);
  const ready = await GET();
  expect(ready.status).toBe(200);
  expect(ready.headers.get("cache-control")).toBe("no-store");
  expect(await ready.json()).toMatchObject({ watchdogReady: true });
  writer.completed(false);
  const unavailable = await GET();
  expect(unavailable.status).toBe(503);
  expect(await unavailable.json()).toMatchObject({ status: "not_ready", watchdogReady: false });
  vi.stubEnv("RESPONSEOS_QUALIFICATION_ACTIVATION", "DISABLED");
  expect((await GET()).status).toBe(200);
});
