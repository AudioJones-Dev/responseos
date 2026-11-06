import { expect, test, vi } from "vitest";
import { PilotWatchdog, telnyxWatchdogTransport, type WatchdogCall } from "@/lib/communications/pilot/watchdog";
import { pilotConfigSchema } from "@/lib/communications/pilot/config";
import { testPilotConfig } from "../fixtures/frl-pilot";

const call = (id = "a", session = "s", duration = 0): WatchdogCall => ({ call_control_id: id, call_leg_id: id, call_session_id: session, call_duration: duration });
test("observed session deadline survives absence and catches a late child leg", async () => {
  let calls: WatchdogCall[] = []; const hangup = vi.fn();
  const w = new PilotWatchdog({ list: async () => calls, hangup }, true, 999999);
  await w.scan(0); calls = [call()]; await w.scan(1000);
  for (let now = 2000; now < 241000; now += 1000) await w.scan(now);
  expect(hangup).not.toHaveBeenCalled(); await w.scan(241000);
  expect(hangup).toHaveBeenCalledOnce(); calls = []; await w.scan(242000);
  calls = [call("late")]; await w.scan(243000);
  expect(hangup.mock.calls[1][0]).toBe("late");
});
test("malformed provider inventory is not an empty inventory", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ call_control_id: "a" }] }))));
  try { await expect(telnyxWatchdogTransport("test", "123").list()).rejects.toThrow(); }
  finally { vi.unstubAllGlobals(); }
});
test("restart terminates existing legs and requires subsequent absence for terminal evidence", async () => {
  const list = vi.fn().mockResolvedValueOnce([call()]).mockResolvedValueOnce([]); const hangup = vi.fn();
  const w = new PilotWatchdog({ list, hangup }, true, 999999);
  expect((await w.scan(0)).terminalVerified).toBe(false); expect(hangup).toHaveBeenCalledOnce();
  expect((await w.scan(1000)).terminalVerified).toBe(true);
});
test("backup age targets every related leg, never an unrelated session", async () => {
  const list = vi.fn().mockResolvedValueOnce([]).mockResolvedValue([call("a", "s", 240), call("b"), call("c", "other")]); const hangup = vi.fn();
  const w = new PilotWatchdog({ list, hangup }, true, 999999); await w.scan(0); await w.scan(1000);
  expect(hangup.mock.calls.map(c => c[0])).toEqual(["a", "b"]);
});
test("inventory outage or scheduling gap fails closed on recovery", async () => {
  const list = vi.fn().mockResolvedValueOnce([]).mockRejectedValueOnce(new Error()).mockResolvedValue([call()]); const hangup = vi.fn();
  const w = new PilotWatchdog({ list, hangup }, true, 999999); await w.scan(0);
  await expect(w.scan(1000)).rejects.toThrow(); await w.scan(2000); expect(hangup).toHaveBeenCalledOnce();
  await w.scan(20000); expect(hangup).toHaveBeenCalledTimes(2);
});
test("uncertain hangup reuses command ID; closed window continues enforcement", async () => {
  const hangup = vi.fn().mockRejectedValueOnce(new Error()).mockResolvedValue(undefined);
  const w = new PilotWatchdog({ list: async () => [call()], hangup }, true, 500);
  expect((await w.scan(0)).failed).toBe(1); await w.scan(1000);
  expect(hangup.mock.calls[0]).toEqual(hangup.mock.calls[1]);
});
test("observe mode never commands and old provider-guarantee config is rejected", async () => {
  const hangup = vi.fn(); const w = new PilotWatchdog({ list: async () => [call()], hangup }, false, 0);
  expect((await w.scan(1)).targeted).toBe(1); expect(hangup).not.toHaveBeenCalled();
  expect(pilotConfigSchema.safeParse({ ...testPilotConfig(), durationPolicy: undefined, providerCallLimitsVerified: true }).success).toBe(false);
});
test("transport scopes pagination to configured application and never follows provider URLs", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [call()], meta: { cursors: { after: "cursor" }, next: "https://untrusted.invalid" } })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ data: [call("b")], meta: { cursors: {} } })));
  vi.stubGlobal("fetch", fetcher);
  try { expect(await telnyxWatchdogTransport("test", "123").list()).toHaveLength(2); expect(fetcher.mock.calls[1][0]).toContain("/connections/123/active_calls?page[limit]=100&page[after]=cursor"); }
  finally { vi.unstubAllGlobals(); }
});
