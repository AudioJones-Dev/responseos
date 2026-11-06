import { randomUUID } from "node:crypto";
import { afterEach, expect, test, vi } from "vitest";
import { approvePilot, commandAllowed, latest, observePilot, pendingPilot, tickPilot } from "@/lib/communications/pilot/machine";
import { telnyxDeletionTransport } from "@/lib/communications/pilot/deletion";
import { callerLeg, pilotNow } from "../fixtures/frl-pilot";
import type { FrlPilotDeletion } from "@prisma/client";

afterEach(() => vi.unstubAllGlobals());
const pending = () => pendingPilot(randomUUID(), callerLeg, "+13055550103", pilotNow, pilotNow + 300000, "frl-recorded-v1", "keypad");
test("manual admission has no answer intent and expires without consent", () => {
  const s = pending(); expect(s.intents).toEqual([]);
  expect(approvePilot(s, "operator", s.deadline)).toBe(false);
  const ended = tickPilot(s, s.deadline, true);
  expect(ended.stage).toBe("ending"); expect(ended.intents.map(i => i.purpose)).toEqual(["hangup"]);
});
test("approval is single use and keypad mode cannot dial or capture", () => {
  let s = pending(); expect(approvePilot(s, "operator", pilotNow + 1)).toBe(true);
  expect(approvePilot(s, "operator", pilotNow + 2)).toBe(false);
  s = observePilot(s, { id: "answer", kind: "answered", at: pilotNow + 10, role: "caller", token: latest(s, "answer")!.id }, pilotNow + 10);
  expect(s.stage).toBe("keypad");
  for (const digit of ["1", "2", "*"]) s = observePilot(s, { id: randomUUID(), kind: "digit", digit, at: pilotNow + 20, role: "caller", token: latest(s, "keypad")!.id }, pilotNow + 20);
  expect(s.digits).toEqual(["1", "2", "*"]); expect(s.stage).toBe("ending");
  expect(s.windows).toEqual([]); expect(s.grants).toEqual([]);
  for (const purpose of ["dial", "name", "conversation", "bridge"] as const) expect(commandAllowed(s, { id: randomUUID(), purpose, role: "caller", createdAt: pilotNow, deadline: pilotNow + 10000 }, pilotNow + 30)).toBe(false);
});
function task(kind = "recording"): FrlPilotDeletion {
  const id = randomUUID();
  return { id, account_id: "a", run_id: "r", recording_id: id, resource_id: id, kind, due_at: new Date(), next_attempt_at: new Date(), state: "pending", attempts: 0, last_error: null, verified_at: null };
}
test("recording deletion validates application, deletes audio and verifies absence", async () => {
  const t = task();
  const fetch = vi.fn().mockResolvedValueOnce(Response.json({ data: { id: t.resource_id, connection_id: "app" } }))
    .mockResolvedValueOnce(Response.json({ data: [] })).mockResolvedValueOnce(Response.json({ data: { transcription_text: "PRIVATE" } })).mockResolvedValueOnce(new Response(null, { status: 404 }));
  vi.stubGlobal("fetch", fetch);
  expect(await telnyxDeletionTransport("secret", "app")(t)).toBe("verified");
  expect(fetch.mock.calls[2][1].method).toBe("DELETE");
});
test("foreign provider recording is never deleted", async () => {
  const t = task(); const fetch = vi.fn().mockResolvedValue(Response.json({ data: { id: t.resource_id, connection_id: "foreign" } }));
  vi.stubGlobal("fetch", fetch);
  expect(await telnyxDeletionTransport("secret", "app")(t)).toBe("identity_mismatch"); expect(fetch).toHaveBeenCalledTimes(1);
});
test("accepted deletion is not verified while resource is still readable", async () => {
  const t = task("transcription");
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => Response.json({ data: { id: t.resource_id, recording_id: t.recording_id } })));
  expect(await telnyxDeletionTransport("secret", "app")(t)).toBe("retry");
});
