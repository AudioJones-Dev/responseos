import { expect, test, vi } from "vitest";
import { runGrokWatchdog } from "@/lib/grok/watchdogLoop";

test("repeated session failures retain healthy-session cadence and reset whole-sweep backoff", async () => {
  const sweep = vi.fn().mockRejectedValueOnce(Error("database_down")).mockResolvedValue({ inspected: 2, failed: 1 });
  const delays: number[] = [], alert = vi.fn();
  await expect(runGrokWatchdog({ loop: true, sweep, alert, pause: async ms => { delays.push(ms); if (delays.length === 5) throw Error("test_complete"); } })).rejects.toThrow("test_complete");
  expect(delays).toEqual([2000, 1000, 1000, 1000, 1000]);
  expect(sweep).toHaveBeenCalledTimes(5);
  expect(alert.mock.calls.map(([scope]) => scope)).toEqual(["sweep", "session", "session", "session", "session"]);
});

test("only whole-sweep failures back off and one-shot session failure returns unhealthy", async () => {
  const delays: number[] = [];
  await expect(runGrokWatchdog({ loop: true, sweep: async () => { throw Error("database_down"); }, alert: vi.fn(), pause: async ms => { delays.push(ms); if (delays.length === 6) throw Error("test_complete"); } })).rejects.toThrow("test_complete");
  expect(delays).toEqual([2000, 4000, 8000, 16000, 30000, 30000]);
  const pause = vi.fn();
  expect(await runGrokWatchdog({ loop: false, sweep: async () => ({ inspected: 2, failed: 1 }), alert: vi.fn(), pause })).toBe(false);
  expect(pause).not.toHaveBeenCalled();
});
