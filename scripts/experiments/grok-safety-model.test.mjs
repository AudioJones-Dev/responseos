import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { createSyntheticCall, transitionSyntheticCall as step, syntheticTerminationConfirmed as confirmed } from "./grok-safety-model.mjs";

const target = { accountId: "fictional-a", captureId: "capture-a", generation: 1, assignmentId: "assignment-a", telnyxCallId: "carrier-a", sessionId: "session-a", legId: "leg-a" };
const xaiCallId = "00000000-0000-0000-0000-000000000001";
const event = (type, extra = {}) => ({ type, target, ...extra });
const initial = () => createSyntheticCall(target, "worker-a", 1000, 100);
const consent = state => step(state, event("consent", { disclosureCompleted: true, digit: "1", grantId: "grant-a" }), 1001).state;
const reserved = () => step(consent(initial()), event("reserve_handoff", { workerId: "worker-a" }), 1002).state;
const dispatched = () => step(reserved(), event("dispatch_handoff", { workerId: "worker-a" }), 1003).state;
const bound = () => step(dispatched(), event("bind_xai", { xaiCallId, syntheticCorrelation: "exact_fixture" }), 1004).state;

test("disclosure and durable-grant fixture precede any handoff effect", () => {
  assert.throws(() => step(initial(), event("reserve_handoff", { workerId: "worker-a" }), 1001));
  for (const digit of ["2", "", null]) assert.throws(() => step(initial(), event("consent", { disclosureCompleted: true, digit, grantId: "grant-a" }), 1001));
  assert.throws(() => step(initial(), event("consent", { disclosureCompleted: false, digit: "1", grantId: "grant-a" }), 1001));
  const result = step(reserved(), event("dispatch_handoff", { workerId: "worker-a" }), 1003);
  assert.deepEqual(result.effects, [{ type: "synthetic_sip_handoff", target }]);
  assert.throws(() => step(result.state, event("dispatch_handoff", { workerId: "worker-a" }), 1004));
});

for (const key of Object.keys(target)) test(`rejects changed ${key} without changing saved authority`, () => {
  const state = reserved();
  const before = structuredClone(state);
  const changed = { ...target, [key]: key === "generation" ? 2 : "other" };
  for (const type of ["dispatch_handoff", "withdraw", "operator_end", "terminal_evidence", "heartbeat"]) {
    assert.throws(() => step(state, event(type, { target: changed, workerId: "worker-a", syntheticRole: "operator" }), 1003), /exact_target_required/);
  }
  assert.deepEqual(state, before);
});

test("withdrawal between reservation and dispatch permanently vetoes media handoff", () => {
  const result = step(reserved(), event("withdraw"), 1003);
  assert.equal(result.state.contentClosed, true);
  assert.deepEqual(result.effects.map(e => e.provider), ["telnyx"]);
  assert.throws(() => step(result.state, event("dispatch_handoff", { workerId: "worker-a" }), 1004));
  assert.throws(() => step(result.state, event("consent", { disclosureCompleted: true, digit: "1", grantId: "later-grant" }), 1004), /consent_not_eligible/);
});

test("withdrawal after dispatch cannot recall an issued handoff; termination stays pending", () => {
  const sent = step(reserved(), event("dispatch_handoff", { workerId: "worker-a" }), 1003);
  const withdrawn = step(sent.state, event("withdraw"), 1004);
  assert.equal(sent.effects[0].type, "synthetic_sip_handoff");
  assert.equal(withdrawn.state.handoff, "consumed");
  assert.equal(withdrawn.state.contentClosed, true);
  assert.equal(confirmed(withdrawn.state), false);
});

test("termination of one call does not mutate another tenant or generation", () => {
  const otherTarget = { ...target, accountId: "fictional-b", captureId: "capture-b", generation: 2, telnyxCallId: "carrier-b" };
  const other = createSyntheticCall(otherTarget, "worker-b", 1000, 100);
  const savedOther = structuredClone(other);
  const result = step(bound(), event("withdraw"), 1005);
  assert.deepEqual(other, savedOther);
  assert.ok(result.effects.every(effect => effect.target.accountId === target.accountId && effect.target.generation === target.generation));
  assert.throws(() => step(other, event("operator_end", { syntheticRole: "operator" }), 1005), /exact_target_required/);
});

test("late xAI binding after withdrawal produces only exact termination", () => {
  const stopped = step(dispatched(), event("withdraw"), 1004).state;
  const late = step(stopped, event("bind_xai", { xaiCallId, syntheticCorrelation: "exact_fixture" }), 1005);
  assert.equal(late.state.contentClosed, true);
  assert.deepEqual(late.effects.map(e => [e.type, e.provider, e.callId]), [["synthetic_whole_call_hangup", "xai", xaiCallId]]);
  assert.deepEqual(step(late.state, event("bind_xai", { xaiCallId, syntheticCorrelation: "exact_fixture" }), 1006).effects, []);
  assert.throws(() => step(late.state, event("bind_xai", { xaiCallId: xaiCallId.replace(/1$/, "2"), syntheticCorrelation: "exact_fixture" }), 1006));
});

test("operator fallback remains available independently of worker health", () => {
  assert.throws(() => step(bound(), event("operator_end", { syntheticRole: "client_admin" }), 1005));
  const result = step(bound(), event("operator_end", { syntheticRole: "operator" }), 1005);
  assert.deepEqual(result.effects.map(e => e.provider), ["telnyx", "xai"]);
  assert.equal(confirmed(result.state), false);
});

test("lease expiration cannot be revived by a late heartbeat", () => {
  assert.throws(() => step(bound(), event("heartbeat", { workerId: "worker-a" }), 1100), /worker_lease_terminal/);
  const stopped = step(bound(), event("watchdog"), 1100);
  assert.deepEqual(stopped.effects.map(e => e.provider), ["telnyx", "xai"]);
  assert.throws(() => step(stopped.state, event("heartbeat", { workerId: "worker-a" }), 1101));
  assert.deepEqual(step(stopped.state, event("watchdog"), 1101).effects, []);
});

test("live heartbeats extend only the exact worker lease", () => {
  assert.throws(() => step(bound(), event("heartbeat", { workerId: "worker-b" }), 1050));
  const renewed = step(bound(), event("heartbeat", { workerId: "worker-a" }), 1050);
  assert.equal(renewed.state.deadline, 1150);
  assert.deepEqual(step(renewed.state, event("watchdog"), 1100).effects, []);
});

test("accepted, failed and uncertain hangup results never confirm termination or resend", () => {
  for (const result of ["accepted", "failed", "uncertain"]) {
    let state = step(bound(), event("control_lost", { workerId: "worker-a" }), 1005).state;
    for (const commandId of state.terminationClaims) state = step(state, event("termination_result", { commandId, result }), 1006).state;
    assert.equal(confirmed(state), false);
    assert.deepEqual(step(state, event("operator_end", { syntheticRole: "operator" }), 1007).effects, []);
  }
});

test("both exact provider terminal fixtures and observation are required after handoff", () => {
  let state = bound();
  assert.throws(() => step(state, event("terminal_evidence", { provider: "xai", callId: xaiCallId, syntheticAuthentication: "unverified" }), 1005));
  assert.throws(() => step(state, event("terminal_evidence", { provider: "xai", callId: "other", syntheticAuthentication: "exact_fixture" }), 1005));
  state = step(state, event("terminal_evidence", { provider: "telnyx", callId: target.telnyxCallId, syntheticAuthentication: "exact_fixture" }), 1005).state;
  assert.equal(confirmed(state), false);
  state = step(state, event("terminal_evidence", { provider: "xai", callId: xaiCallId, syntheticAuthentication: "exact_fixture" }), 1006).state;
  assert.equal(confirmed(state), false);
  state = step(state, event("observed_termination"), 1007).state;
  assert.equal(confirmed(state), true);
  assert.equal(state.contentClosed, true);
});

test("unknown xAI identity after handoff cannot be declared fully terminated", () => {
  let state = step(dispatched(), event("terminal_evidence", { provider: "telnyx", callId: target.telnyxCallId, syntheticAuthentication: "exact_fixture" }), 1004).state;
  state = step(state, event("observed_termination"), 1005).state;
  assert.equal(confirmed(state), false);
});

test("sequentially committed concurrent requests yield one handoff and one termination per provider", async () => {
  let state = reserved();
  const effects = [];
  const apply = async input => { const result = step(state, input, 1005); state = result.state; effects.push(...result.effects); };
  const starts = await Promise.allSettled([apply(event("dispatch_handoff", { workerId: "worker-a" })), apply(event("dispatch_handoff", { workerId: "worker-a" }))]);
  assert.equal(starts.filter(r => r.status === "fulfilled").length, 1);
  await apply(event("bind_xai", { xaiCallId, syntheticCorrelation: "exact_fixture" }));
  await Promise.all([apply(event("withdraw")), apply(event("operator_end", { syntheticRole: "operator" })), apply(event("control_lost", { workerId: "worker-a" }))]);
  assert.equal(effects.filter(e => e.type === "synthetic_sip_handoff").length, 1);
  assert.deepEqual(effects.filter(e => e.type === "synthetic_whole_call_hangup").map(e => e.provider), ["telnyx", "xai"]);
});

test("separate watchdog process detects expired saved lease after worker is killed", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "responseos-grok-synthetic-"));
  const worker = spawn(process.execPath, ["-e", "process.stdout.write('ready'); setInterval(() => {}, 1000)"], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  try {
    await once(worker.stdout, "data");
    const workerPid = worker.pid;
    const input = path.join(dir, "state.json"), output = path.join(dir, "result.json");
    fs.writeFileSync(input, JSON.stringify(bound()));
    const exited = once(worker, "exit");
    worker.kill();
    await exited;
    const watchdog = spawnSync(process.execPath, [fileURLToPath(new URL("./grok-watchdog-fixture.mjs", import.meta.url)), input, output, "1100"], { windowsHide: true, encoding: "utf8", timeout: 5000 });
    assert.equal(watchdog.status, 0, watchdog.stderr);
    const result = JSON.parse(fs.readFileSync(output, "utf8"));
    assert.notEqual(result.pid, workerPid);
    assert.notEqual(result.pid, process.pid);
    assert.equal(result.state.stopReason, "control_lease_expired");
    assert.equal(result.state.contentClosed, true);
    assert.deepEqual(result.effects.map(e => [e.provider, e.callId, e.target]), [["telnyx", target.telnyxCallId, target], ["xai", xaiCallId, target]]);
    assert.equal(confirmed(result.state), false);
  } finally {
    if (worker.exitCode === null && worker.signalCode === null) worker.kill();
    fs.rmSync(dir, { recursive: true });
  }
});
