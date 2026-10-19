import test from "node:test";
import assert from "node:assert/strict";
import { parseUnverifiedIncomingCall, previewSipSession } from "./grok-direct-sip.mjs";

const callId = "00000000-0000-0000-0000-000000000001";
const incoming = () => ({ object: "event", id: "evt_fixture", type: "realtime.call.incoming", created_at: 1792432800, data: { call_id: callId, sip_headers: [{ name: "To", value: "+15555550199" }], metadata: { accountId: "attacker", authenticated: true } } });

test("parsing never grants authentication or tenant authority", () => {
  assert.deepEqual(parseUnverifiedIncomingCall(JSON.stringify(incoming())), {
    authenticated: false, eventId: "evt_fixture", callId, createdAt: 1792432800,
  });
});

for (const [name, change] of [
  ["wrong event", e => { e.type = "realtime.call.ended"; }],
  ["missing call", e => { delete e.data.call_id; }],
  ["URL injection", e => { e.data.call_id = callId + "&model=other"; }],
  ["invalid date", e => { e.created_at = "1792432800"; }],
  ["empty id", e => { e.id = ""; }],
]) test(`rejects ${name}`, () => {
  const event = incoming(); change(event);
  assert.throws(() => parseUnverifiedIncomingCall(JSON.stringify(event)), /invalid_incoming_envelope/);
});

test("bounds untrusted envelopes without exposing their content in errors", () => {
  for (const raw of [null, "private invalid payload", "x".repeat(65537), "null", "[]"]) {
    assert.throws(() => parseUnverifiedIncomingCall(raw), { message: "invalid_incoming_envelope" });
  }
});

test("session preview pins model and supplies no start, tools or resumption", () => {
  const plan = previewSipSession(callId);
  const url = new URL(plan.url);
  assert.equal(url.origin, "wss://api.x.ai");
  assert.equal(url.pathname, "/v1/realtime");
  assert.deepEqual([...url.searchParams], [["call_id", callId], ["model", "grok-voice-3.0"]]);
  assert.equal(plan.executable, false);
  assert.deepEqual(plan.frames.map(f => f.type), ["session.update"]);
  assert.deepEqual(plan.frames[0].session.tools, []);
  assert.equal(plan.frames[0].session.turn_detection, null);
  assert.equal(plan.frames[0].session.resumption.enabled, false);
});

test("mutating one preview cannot enable tools in another", () => {
  previewSipSession(callId).frames[0].session.tools.push({ type: "function" });
  assert.deepEqual(previewSipSession(callId).frames[0].session.tools, []);
});

test("rejects unbounded and injected call identifiers", () => {
  for (const value of [undefined, "", {}, "../hangup", callId + "#fragment", callId + "?model=other"]) {
    assert.throws(() => previewSipSession(value), /invalid_call_id/);
  }
});
