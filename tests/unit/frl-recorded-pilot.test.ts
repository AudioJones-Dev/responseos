import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, test, vi } from "vitest";
import { configDigest, loadPilotConfig, pilotConfigSchema, pilotOpen } from "@/lib/communications/pilot/config";
import { commandAllowed, endPilot, latest, observePilot, tickPilot, type Observation } from "@/lib/communications/pilot/machine";
import { decodeToken, observation, pilotRequest, stateToken, telnyxPilotTransport } from "@/lib/providers/telnyx/pilot";
import { machineHarness, pilotNow, testPilotConfig } from "../fixtures/frl-pilot";

afterEach(() => vi.unstubAllGlobals());
describe("FRL recorded pilot", () => {
  test("requires caller-only name then two observed bridge legs and both grants", () => {
    const h = machineHarness(); h.callerConsent(); h.nameSaved();
    expect(h.state.windows[0].roles).toEqual(["caller"]);
    expect(h.state.operator).toBeUndefined();
    h.operatorConsent(); h.send("bridged");
    expect(h.state.windows).toHaveLength(1);
    h.send("bridged", "operator");
    expect(h.state.windows.map(w => w.roles)).toEqual([["caller"], ["caller", "operator"]]);
    expect(h.state.stage).toBe("conversation");
    expect(h.state.grants.every(g => g.recording && g.transcription)).toBe(true);
  });
  test.each(["2", "", "9"])("caller refusal/invalid %s never captures but still offers routing", digit => {
    const h = machineHarness(); h.callerConsent(digit); h.operatorConsent(); h.bridge();
    expect(h.state.stage).toBe("conversation"); expect(h.state.windows).toEqual([]);
    expect(h.state.captureDenied).toBe(true);
  });
  test("operator may accept without capture after a caller-consented name", () => {
    const h = machineHarness(); h.callerConsent(); h.nameSaved(); h.operatorConsent("2"); h.bridge();
    expect(h.state.stage).toBe("conversation"); expect(h.state.windows).toHaveLength(1);
  });
  test("operator silence does not bridge voicemail", () => {
    const h = machineHarness(); h.callerConsent("2"); h.operatorConsent("");
    expect(h.state.stage).toBe("unavailable");
    expect(h.state.intents.some(i => i.purpose === "bridge")).toBe(false);
  });
  test("caller timeout is a durable negative decision", () => {
    const h = machineHarness(); h.send("answered");
    const s = tickPilot(h.state, h.state.deadline + 1, true);
    expect(s.stage).toBe("hold"); expect(s.grants[0].recording).toBe(false);
  });
  test.each(["caller", "operator"] as const)("%s withdrawal cancels capture and requests both hangups", role => {
    const h = machineHarness(); h.callerConsent(); h.nameSaved(); h.operatorConsent(); h.bridge();
    const start = latest(h.state, "conversation")!;
    h.send("withdraw", role);
    expect(commandAllowed(h.state, start, h.now)).toBe(false);
    expect(h.state.intents.filter(i => i.purpose === "hangup")).toHaveLength(2);
    expect(h.state.intents.some(i => i.purpose === "stop")).toBe(true);
    h.send("consent", role, { digit: "1", valid: true });
    expect(h.state.stage).toBe("ending"); expect(h.state.revokedAt).toBeTruthy();
  });
  test.each(["caller", "operator"] as const)("%s hangup requests counterpart termination; acknowledgment is not termination", role => {
    const h = machineHarness(); h.callerConsent("2"); h.operatorConsent(); h.bridge(); h.send("hangup", role);
    expect(h.state.stage).toBe("ending");
    h.send("hangup", role === "caller" ? "operator" : "caller");
    expect(h.state.stage).toBe("ended");
  });
  test("uncertain dial prevents false completion until the missing leg is reconciled", () => {
    const h = machineHarness(); h.callerConsent("2"); h.send("prompt_done"); h.state.dialUnknown = true;
    h.send("hangup"); expect(h.state.stage).toBe("ending");
    expect(tickPilot(h.state, h.now + 60000, true).stage).toBe("ending");
  });
  test("replayed consent and stale prompt callbacks cannot reopen a window", () => {
    const h = machineHarness(); h.send("answered"); const token = latest(h.state, "caller_consent")!.id;
    h.send("consent", "caller", { digit: "1", valid: true }); h.nameSaved();
    h.send("consent", "caller", { digit: "1", valid: true, token });
    expect(h.state.grants).toHaveLength(1); expect(h.state.windows).toHaveLength(1);
  });
  test.each(["start", "end", "channels"])("rejects unproven %s on bridged recording", field => {
    const h = machineHarness(); h.callerConsent(); h.nameSaved(); h.operatorConsent(); h.bridge();
    const w = h.state.windows[1];
    h.send("recording", "caller", { recordingId: randomUUID(), start: w.authorizedAt + 1, end: w.authorizedAt + 50, channels: "dual",
      ...({ start: { start: w.authorizedAt - 1 }, end: { end: w.limitAt + 1 }, channels: { channels: "single" } }[field]) });
    expect(h.state.incident).toBe("recording_interval_unproven"); expect(h.state.revokedAt).toBeTruthy();
  });
  test("unknown topology during name capture fails closed", () => {
    const h = machineHarness(); h.callerConsent(); h.send("prompt_done"); h.send("bridged");
    expect(h.state.incident).toBe("unexpected_topology");
  });
  test("a new bridge event during the conversation cannot reuse the old roster", () => {
    const h = machineHarness(); h.callerConsent(); h.nameSaved(); h.operatorConsent(); h.bridge();
    h.send("bridged"); expect(h.state.incident).toBe("unexpected_topology");
    h.send("hangup"); h.send("hangup", "operator");
    expect(h.state.stage).toBe("ending");
    expect(h.state.topologyUnknown).toBe(true);
  });
  test("expired stop watchdog retains uncertain physical status", () => {
    const h = machineHarness(); h.callerConsent(); h.send("prompt_done");
    const s = tickPilot(h.state, h.state.deadline + 1, true);
    expect(s.stage).toBe("ending"); expect(s.caller.endedAt).toBeUndefined();
  });
  test("kill switch blocks starts but permits cleanup", () => {
    const h = machineHarness(); h.callerConsent(); h.send("prompt_done");
    const s = tickPilot(h.state, h.now, false);
    expect(commandAllowed(s, latest(s, "name")!, h.now)).toBe(false);
    expect(commandAllowed(s, latest(s, "hangup")!, h.now)).toBe(true);
  });
  test("commands use explicit dial/bridge, bounded recordings and post-record transcription", () => {
    const h = machineHarness(); const c = testPilotConfig(); h.callerConsent(); h.nameSaved(); h.operatorConsent();
    const dial = pilotRequest(h.state, latest(h.state, "dial")!, c, h.now);
    expect(dial.path).toBe("/v2/calls"); expect(dial.body).toMatchObject({ to: c.operator, from: c.number, bridge_on_answer: false, timeout_secs: 20 });
    expect(dial.body).not.toHaveProperty("record"); expect(dial.body).not.toHaveProperty("stream_url");
    h.bridge(); const record = pilotRequest(h.state, latest(h.state, "conversation")!, c, h.now);
    expect(record.body).toMatchObject({ channels: "dual", recording_track: "both", transcription: true });
    expect(Number(record.body.max_length)).toBeLessThanOrEqual(300);
    expect(decodeToken(record.body.client_state)?.runId).toBe(h.state.id);
    endPilot(h.state, h.now);
    const hangup = pilotRequest(h.state, latest(h.state, "hangup")!, c, h.now);
    expect(hangup.body).not.toHaveProperty("client_state");
  });
  test("native mapping requires all three leg identifiers", () => {
    const h = machineHarness(); const event = { data: { id: "e", event_type: "call.answered", occurred_at: new Date(h.now + 1).toISOString(), payload: { call_control_id: h.state.caller.controlId, call_leg_id: "wrong", call_session_id: "session", connection_id: "app" } } };
    expect(observation(event, h.state)).toBeNull();
  });
  test("foreign state cannot correlate a known leg", () => {
    const h = machineHarness(); const p = h.state.caller;
    expect(observation({ data: { id: "e", event_type: "call.answered", occurred_at: new Date().toISOString(), payload: { call_control_id: p.controlId, call_leg_id: p.legId, call_session_id: p.sessionId, connection_id: "app", client_state: stateToken(randomUUID(), randomUUID()) } } }, h.state)).toBeNull();
  });
  test("malformed config and endpoint loops fail closed", () => {
    expect(loadPilotConfig({ RESPONSEOS_FRL_PILOT_CONFIG: "bad" })).toBeNull();
    const c = testPilotConfig(); expect(pilotConfigSchema.safeParse({ ...c, operator: c.number }).success).toBe(false);
    expect(pilotOpen(c, pilotNow, {})).toBe(false);
    const env = { RESPONSEOS_FRL_PILOT_ENABLED: "true", RESPONSEOS_REQUIRE_AUTH: "true", RESPONSEOS_FRL_PILOT_DEPLOYMENT_ID: "synthetic-pilot", DATABASE_URL: "postgresql://localhost/pilot" };
    expect(pilotOpen(c, pilotNow, env)).toBe(true);
    expect(pilotOpen(c, pilotNow, { ...env, VERCEL_ENV: "production" })).toBe(false);
    expect(pilotOpen(c, pilotNow, { ...env, DATABASE_URL: "postgresql://elsewhere/pilot" })).toBe(false);
    expect(configDigest(c)).not.toContain(c.operator);
  });
  test.each([500, 429])( "HTTP %s is uncertain and is not automatically retried", async status => {
    const fetcher = vi.fn().mockResolvedValue(new Response("{}", { status })); vi.stubGlobal("fetch", fetcher);
    expect(await telnyxPilotTransport("synthetic")({ path: "/v2/calls", body: {} }, true)).toEqual({ kind: "uncertain" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  test("HTTP acceptance never creates capture observation", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"data":{"result":"ok"}}')));
    expect(await telnyxPilotTransport("synthetic")({ path: "/v2/calls/test/actions/record_start", body: {} }, false)).toEqual({ kind: "accepted" });
    const h = machineHarness(); h.callerConsent(); h.send("prompt_done"); expect(h.state.windows[0].startedAt).toBeUndefined();
  });
  test("late affirmative input cannot restore a revoked call", () => {
    const h = machineHarness(); h.send("answered"); endPilot(h.state, h.now, "withdrawn", true);
    const event = { id: "e", kind: "consent", at: h.now + 1, role: "caller", digit: "1", valid: true, token: latest(h.state, "caller_consent")!.id } as Observation;
    expect(observePilot(h.state, event, h.now + 1).grants).toEqual([]);
  });
});
