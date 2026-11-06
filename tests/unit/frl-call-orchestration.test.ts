import { describe, expect, it } from "vitest";
import { generateKeyPairSync, sign } from "node:crypto";
import { MockCallOrchestrator, type CallInput, type CallInputEnvelope } from "@/lib/communications/orchestration/mock-call";
import type { CallCommand, CommandKind } from "@/lib/communications/orchestration/contracts";
import { commandAccepted, TelnyxCallControlPlanner } from "@/lib/providers/telnyx/call-control-plan";
import { commandId, validIndependentRoute } from "@/lib/communications/orchestration/contracts";
import { normalizeCallControlFixture } from "@/lib/providers/telnyx/call-event-plan";
import { permitsTranscript } from "@/lib/communications/consent/capture";
import providerContracts from "../fixtures/telnyx/call-command-contracts.json";

const t = (seconds: number) => new Date(Date.UTC(2026, 10, 6, 12, 0, seconds)).toISOString();
const route = { accountId: "tenant-a", founderDestination: "+12025550102", forwardedNumbers: ["+12025550101"], verifiedIndependentEndpoint: true };
const context = { accountId: "tenant-a", callId: "call-a", callControlId: "control-a", callerLegId: "caller-a", founderLegId: "founder-a", route };
function harness(overrides: Partial<typeof context> = {}) {
  const c = { ...context, ...overrides };
  const call = new MockCallOrchestrator(c, "provisional-v1", t(0), t(120));
  let seconds = 0;
  const commands: CallCommand[] = [];
  const telemetry: unknown[] = [];
  const event = (input: CallInput, extra: Partial<CallInputEnvelope> = {}) => {
    const envelope = { ...input, accountId: c.accountId, callId: c.callId, legId: c.callerLegId,
      id: `event-${++seconds}`, at: t(seconds), ...extra } as CallInputEnvelope;
    if (extra.at) seconds = Math.max(seconds, (Date.parse(extra.at) - Date.parse(t(0))) / 1000);
    return envelope;
  };
  const send = (input: CallInput, extra: Partial<CallInputEnvelope> = {}) => {
    const result = call.dispatch(event(input, extra)); commands.push(...result.commands); telemetry.push(...result.telemetry); return result;
  };
  const find = (kind: CommandKind, prompt?: string) => commands.findLast(c => c.kind === kind && (!prompt || c.prompt === prompt))!;
  const finishPrompt = (prompt: string) => send({ kind: "prompt_finished", commandId: find("speak", prompt).id });
  const start = (founder = true) => {
    send({ kind: "inbound" }); send({ kind: "answered" }); finishPrompt("greeting");
    if (founder) send({ kind: "decision", choice: "accept" }, { legId: c.founderLegId });
  };
  const accept = () => { start(); send({ kind: "dtmf", digit: "1" }); };
  const name = () => {
    accept(); send({ kind: "command_result", commandId: find("start_transcription").id, accepted: true });
    send({ kind: "synthetic_capture_observation", commandId: find("start_transcription").id, state: "started" });
  };
  const stop = () => send({ kind: "synthetic_capture_observation", commandId: find("stop_transcription").id, state: "stopped" });
  return { call, event, send, find, commands, telemetry, finishPrompt, start, accept, name, stop };
}

describe("FRL synthetic command orchestration", () => {
  it("answers, discloses, collects authorized unverified name and transfers without reopening bridge capture", () => {
    const h = harness(); h.name();
    const state = h.call.snapshot();
    expect(state.routing).toBe("NAME_COLLECTION");
    expect(permitsTranscript(state.consent, "caller-a", ["caller-a", "founder-a"], t(7), t(7), new Date(t(8)))).toBe(true);
    h.send({ kind: "name_result", name: "Example Caller", start: t(7), end: t(7) });
    h.finishPrompt("transfer");
    expect(h.find("transfer")).toBeUndefined();
    h.stop();
    expect(h.find("transfer")).toBeDefined();
    h.send({ kind: "transfer_connected" });
    expect(h.call.snapshot()).toMatchObject({ routing: "CONNECTED", callerProvidedName: "Example Caller", identityStatus: "unverified", capture: "stopped_synthetic", crmOutcome: "not_authorized" });
    expect(h.call.snapshot().consent.revokedAt).not.toBeNull();
    h.send({ kind: "hangup" });
    expect(h.call.snapshot().routing).toBe("CALL_ENDED");
    expect(h.commands.filter(c => c.kind === "start_transcription")).toHaveLength(1);
  });
  it.each(["2", "0", "#", "", "11"])("transfers without capture for keypad choice %j", digit => {
    const h = harness(); h.start(); h.send({ kind: "dtmf", digit }); h.finishPrompt("no_consent");
    expect(h.find("transfer")).toBeDefined(); expect(h.find("start_transcription")).toBeUndefined();
  });
  it("times out without capture", () => {
    const h = harness(); h.start(); h.send({ kind: "consent_timeout" }); h.finishPrompt("no_consent");
    expect(h.find("transfer")).toBeDefined(); expect(h.call.snapshot().capture).toBe("off");
  });
  it("does not time out consent on an early timer tick", () => {
    const h = harness(); h.start(false); h.send({ kind: "tick" });
    expect(h.call.snapshot().routing).toBe("CONSENT_PENDING");
    h.send({ kind: "tick" }, { at: t(25) }); expect(h.call.snapshot().routing).toBe("TRANSFER_PENDING");
  });
  it("requires independent founder consent before speech capture", () => {
    const h = harness(); h.start(false); h.send({ kind: "dtmf", digit: "1" }); h.finishPrompt("no_consent");
    expect(h.find("start_transcription")).toBeUndefined(); expect(h.find("transfer")).toBeDefined();
    h.send({ kind: "decision", choice: "accept" }, { legId: "founder-a" });
    expect(h.find("start_transcription")).toBeUndefined();
  });
  it.each(["skip", "recognition_failure"])("transfers when name outcome is %s", outcome => {
    const h = harness(); h.name();
    if (outcome === "skip") h.send({ kind: "name_result", name: null, start: t(7), end: t(7) });
    else h.send({ kind: "name_failed" });
    h.stop(); h.finishPrompt("transfer");
    expect(h.find("transfer")).toBeDefined(); expect(h.call.snapshot().callerProvidedName).toBeNull();
  });
  it.each(["caller-a", "founder-a"])("early revocation by %s preserves transfer", legId => {
    const h = harness(); h.name(); h.send({ kind: "decision", choice: "revoke" }, { legId });
    const late = h.send({ kind: "name_result", name: "Must Not Persist", start: t(7), end: t(7) });
    expect(late.telemetry.some(e => e.code === "content_rejected")).toBe(true);
    h.stop(); h.finishPrompt("no_consent");
    expect(h.find("transfer")).toBeDefined(); expect(h.call.snapshot().callerProvidedName).toBeNull();
    expect(JSON.stringify(h.telemetry)).not.toContain("Must Not Persist");
  });
  it("API acceptance is not a capture acknowledgment", () => {
    const h = harness(); h.accept(); h.send({ kind: "command_result", commandId: h.find("start_transcription").id, accepted: true });
    expect(h.call.snapshot().capture).toBe("start_accepted"); expect(h.call.snapshot().consent.startedAt).toBeNull();
    expect(h.find("speak", "name")).toBeUndefined();
  });
  it("start failure closes authorization and requests cleanup", () => {
    const h = harness(); h.accept(); h.send({ kind: "command_result", commandId: h.find("start_transcription").id, accepted: false });
    expect(h.call.snapshot().consent.revokedAt).not.toBeNull(); expect(h.find("stop_transcription")).toBeDefined();
    expect(h.find("speak", "name")).toBeUndefined();
  });
  it("missing stop acknowledgment fails closed and requests hangup", () => {
    const h = harness(); h.name(); h.send({ kind: "decision", choice: "revoke" }); h.finishPrompt("no_consent");
    h.send({ kind: "command_result", commandId: h.find("stop_transcription").id, accepted: true });
    h.send({ kind: "tick" }, { at: t(30) });
    expect(h.call.snapshot().capture).toBe("unknown"); expect(h.find("hangup")).toBeDefined(); expect(h.find("transfer")).toBeUndefined();
    expect(h.telemetry).toContainEqual(expect.objectContaining({ code: "capture_unconfirmed" }));
  });
  it("failed stop acknowledgment remains unknown", () => {
    const h = harness(); h.name(); h.send({ kind: "decision", choice: "revoke" });
    h.send({ kind: "command_result", commandId: h.find("stop_transcription").id, accepted: false });
    expect(h.call.snapshot().capture).toBe("unknown"); expect(h.find("hangup")).toBeDefined();
  });
  it("rejects delayed start observations after revocation, even after a stop observation", () => {
    const h = harness(); h.accept(); h.send({ kind: "decision", choice: "revoke" }); h.stop();
    h.send({ kind: "synthetic_capture_observation", commandId: h.find("start_transcription").id, state: "started" });
    expect(h.call.snapshot().capture).toBe("unknown"); expect(h.call.snapshot().consent.startedAt).toBeNull(); expect(h.find("hangup")).toBeDefined();
  });
  it.each(["participant_joined", "provider_failure"] as const)("closes capture on %s", kind => {
    const h = harness(); h.name(); h.send({ kind });
    expect(h.call.snapshot().consent.revokedAt).not.toBeNull(); expect(h.find("stop_transcription")).toBeDefined();
  });
  it("deduplicates events and command effects", () => {
    const h = harness(); const event = h.event({ kind: "inbound" });
    expect(h.call.dispatch(event).commands).toHaveLength(1);
    expect(h.call.dispatch(event)).toMatchObject({ commands: [], telemetry: [expect.objectContaining({ code: "duplicate" })] });
    expect(h.send({ kind: "inbound" }).commands).toHaveLength(0);
  });
  it("rejects conflicting event-id reuse", () => {
    const h = harness(); const e = h.event({ kind: "inbound" }); h.call.dispatch(e);
    expect(h.call.dispatch({ ...e, kind: "answered" }).telemetry.some(e => e.code === "event_rejected")).toBe(true);
    expect(h.call.snapshot().consent.revokedAt).not.toBeNull();
  });
  it("out-of-order routing cannot roll back state", () => {
    const h = harness(); h.name(); h.send({ kind: "answered" }, { at: t(1) });
    expect(h.call.snapshot().routing).toBe("NAME_COLLECTION");
  });
  it.each([{ accountId: "tenant-b" }, { callId: "other-call" }, { legId: "other-leg" }])("rejects mismatched context %j", extra => {
    const h = harness(); h.name(); const before = h.call.snapshot();
    const result = h.send({ kind: "name_result", name: "Unknown", start: t(7), end: t(7) }, extra);
    expect(result.commands).toEqual([]); expect(h.call.snapshot()).toEqual(before);
  });
  it("expired consent rejects content and requests stop", () => {
    const h = harness(); h.name(); h.send({ kind: "name_result", name: "Late", start: t(7), end: t(7) }, { at: t(121) });
    expect(h.call.snapshot().callerProvidedName).toBeNull(); expect(h.find("stop_transcription")).toBeDefined();
  });
  it.each(["unsafe_destination", "transfer_failure", "transfer_timeout"])("uses no-capture failure fallback: %s", failure => {
    const h = harness(failure === "unsafe_destination" ? { route: { ...route, founderDestination: route.forwardedNumbers[0] } } : {});
    h.start(); h.send({ kind: "dtmf", digit: "2" }); h.finishPrompt("no_consent");
    if (failure === "transfer_failure") h.send({ kind: "transfer_failed" });
    if (failure === "transfer_timeout") h.send({ kind: "tick" }, { at: t(40) });
    expect(h.call.snapshot().transferOutcome).toBe("failed"); h.finishPrompt("unavailable"); expect(h.find("hangup")).toBeDefined();
  });
  it("revocation after connection never starts a second transfer", () => {
    const h = harness(); h.start(); h.send({ kind: "dtmf", digit: "2" }); h.finishPrompt("no_consent"); h.send({ kind: "transfer_connected" });
    h.send({ kind: "decision", choice: "revoke" });
    expect(h.call.snapshot().routing).toBe("CONNECTED"); expect(h.commands.filter(c => c.kind === "transfer")).toHaveLength(1);
  });
  it("never requests recording, streaming, CRM or real transport", () => {
    const h = harness(); h.name(); const result = h.send({ kind: "crm_export" });
    expect(result.commands).toEqual([]); expect(result.telemetry[0].code).toBe("crm_blocked");
    expect(h.find("start_recording")).toBeUndefined(); expect(h.call.snapshot().mode).toBe("synthetic_only");
    expect(JSON.stringify(h.telemetry)).not.toContain(route.founderDestination);
  });
  it.each(["revoke_first", "ack_first"])("serializes revocation and acknowledgment ordering: %s", ordering => {
    const h = harness(); h.accept();
    const revoke = () => h.send({ kind: "decision", choice: "revoke" });
    const ack = () => h.send({ kind: "synthetic_capture_observation", commandId: h.find("start_transcription").id, state: "started" });
    if (ordering === "revoke_first") { revoke(); ack(); } else { ack(); revoke(); }
    h.send({ kind: "name_result", name: "Rejected", start: t(7), end: t(7) });
    expect(h.call.snapshot().callerProvidedName).toBeNull(); expect(h.call.snapshot().consent.revokedAt).not.toBeNull();
  });
});

describe("documented Telnyx request plans (no executor)", () => {
  const planner = new TelnyxCallControlPlanner();
  const command = (kind: CommandKind): CallCommand => ({ id: commandId("tenant-a", "call-a", kind), accountId: "tenant-a", callId: "call-a", callControlId: "v3:synthetic", legId: "caller-a", kind });
  it.each([
    ["answer", "answer"], ["hangup", "hangup"], ["start_recording", "record_start"], ["stop_recording", "record_stop"],
    ["start_transcription", "transcription_start"], ["stop_transcription", "transcription_stop"], ["stop_streaming", "streaming_stop"],
  ] as const)("maps %s to %s", (kind, action) => {
    const request = planner.plan(command(kind), route);
    expect(request.path).toBe(`/v2/calls/v3%3Asynthetic/actions/${action}`);
    expect(request.body.command_id).toBe(command(kind).id); expect(request.method).toBe("POST");
  });
  it("maps exact prompts and DTMF without pre-consent capture options", () => {
    const request = planner.plan({ ...command("collect_dtmf"), prompt: "consent" }, route);
    expect(request.path).toContain("gather_using_speak");
    expect(request.body).toMatchObject({ minimum_digits: 1, maximum_digits: 1, maximum_tries: 1, timeout_millis: 10000 });
    expect(request.body).not.toHaveProperty("transcription"); expect(request.body).not.toHaveProperty("record");
    expect(planner.plan({ ...command("speak"), prompt: "greeting" }, route).body.payload).toBe("Thank you for calling Florida Ramp & Lift.");
  });
  it("maps bridge and transfer using independent protected route", () => {
    expect(planner.plan(command("transfer"), route).body.to).toBe(route.founderDestination);
    expect(planner.plan(command("bridge"), { ...route, founderCallControlId: "other-control" }).body).toMatchObject({ call_control_id: "other-control", prevent_double_bridge: true });
    expect(() => planner.plan(command("bridge"), { ...route, founderCallControlId: "v3:synthetic" })).toThrow("unsafe_bridge_route");
    expect(validIndependentRoute({ ...route, founderDestination: route.forwardedNumbers[0] }, "tenant-a")).toBe(false);
    expect(() => planner.plan(command("transfer"), { ...route, accountId: "tenant-b" })).toThrow("tenant_route_mismatch");
  });
  it("does not infer capture state from command success", () => {
    expect(commandAccepted({ data: { result: "ok" } })).toBe(true); expect(commandAccepted({ result: "ok" })).toBe(false);
    expect(planner.confirmCaptureState()).toBe("unknown");
  });
  it("scopes idempotency keys to tenant and call", () => {
    expect(commandId("a", "b", "c")).toBe(commandId("a", "b", "c"));
    expect(commandId("a", "b", "c")).not.toBe(commandId("other", "b", "c"));
    expect(commandId("a", "b", "c")).not.toBe(commandId("a", "new-call", "c"));
  });
  it("matches the retrieved official wire schemas rather than SDK argument aliases", () => {
    const schemas = providerContracts.paths as Record<string, { required: string[]; properties: Record<string, { type?: string; enum?: unknown[] }> }>;
    const kinds: CommandKind[] = ["answer", "speak", "collect_dtmf", "transfer", "bridge", "hangup", "start_recording", "stop_recording", "start_transcription", "stop_transcription", "stop_streaming"];
    for (const kind of kinds) {
      const request = planner.plan({ ...command(kind), prompt: "consent" }, { ...route, founderCallControlId: "founder-control" });
      const schema = schemas[request.path.replace("/v2", "").replace("v3%3Asynthetic", "{call_control_id}")];
      expect(schema).toBeDefined();
      for (const key of schema.required) expect(request.body).toHaveProperty(key);
      for (const [key, value] of Object.entries(request.body)) {
        const field = schema.properties[key]; expect(field, `${kind}.${key}`).toBeDefined();
        if (field.enum) expect(field.enum).toContain(value);
        expect(typeof value).toBe(field.type === "integer" ? "number" : field.type);
      }
    }
  });
});

describe("signed offline Telnyx event mapping", () => {
  const keys = generateKeyPairSync("ed25519");
  const binding = { accountId: "tenant-a", callId: "call-a", caller: { controlId: "control-a", legId: "caller-a", sessionId: "session-a" }, commands: [] as CallCommand[] };
  const fixture = (kind: string, payload: Record<string, unknown> = {}) => {
    const rawBody = JSON.stringify({ data: { id: "event-a", event_type: kind, occurred_at: t(1), payload: {
      call_control_id: "control-a", call_leg_id: "caller-a", call_session_id: "session-a", ...payload,
    } } });
    const timestamp = String(Date.parse(t(1)) / 1000);
    return { rawBody, timestamp, signature: sign(null, Buffer.from(`${timestamp}|${rawBody}`), keys.privateKey).toString("base64"),
      publicKey: keys.publicKey.export({ type: "spki", format: "pem" }).toString(), now: new Date(t(1)) };
  };
  it("invalid signature yields no mutation-capable event", () => {
    expect(normalizeCallControlFixture({ ...fixture("call.answered"), signature: "invalid" }, binding)).toEqual({ ok: false, reason: "signature" });
  });
  it("maps routing using server binding, ignoring injected tenant and content", () => {
    const result = normalizeCallControlFixture(fixture("call.answered", { accountId: "evil", transcript: "Discard me" }), binding);
    expect(result).toMatchObject({ ok: true, event: { accountId: "tenant-a", kind: "answered" } });
    expect(JSON.stringify(result)).not.toContain("Discard me");
  });
  it.each(["call.transcription", "call.recording.saved", "call.transcription.started", "call.transcription.stopped"])("does not invent authority from %s", kind => {
    expect(normalizeCallControlFixture(fixture(kind), binding)).toEqual({ ok: false, reason: "unsupported" });
  });
  it("rejects wrong leg/session/call", () => {
    for (const key of ["call_control_id", "call_leg_id", "call_session_id"]) expect(normalizeCallControlFixture(fixture("call.answered", { [key]: "wrong" }), binding)).toMatchObject({ ok: false, reason: "mapping" });
  });
  it("requires known command correlation before interpreting DTMF", () => {
    const command: CallCommand = { id: commandId("tenant-a", "call-a", "gather"), accountId: "tenant-a", callId: "call-a", callControlId: "control-a", legId: "caller-a", kind: "collect_dtmf", prompt: "consent" };
    const data = fixture("call.gather.ended", { client_state: Buffer.from(command.id).toString("base64"), status: "valid", digits: "1" });
    expect(normalizeCallControlFixture(data, binding)).toMatchObject({ ok: false });
    expect(normalizeCallControlFixture(data, { ...binding, commands: [command] })).toMatchObject({ ok: true, event: { kind: "dtmf", digit: "1" } });
  });
  it("runs a complete signed declined-call lifecycle with correlated target-leg callbacks", () => {
    const h = harness();
    let index = 0;
    const target = { controlId: "target-control", legId: "target-leg", sessionId: "session-a" };
    const deliver = (kind: string, payload: Record<string, unknown> = {}) => {
      const unsigned = JSON.parse(fixture(kind, payload).rawBody);
      unsigned.data.id = `signed-${++index}`; unsigned.data.occurred_at = t(index);
      const rawBody = JSON.stringify(unsigned), timestamp = String(Date.parse(t(index)) / 1000);
      const mapped = normalizeCallControlFixture({ ...fixture(kind), rawBody, timestamp, now: new Date(t(index)),
        signature: sign(null, Buffer.from(`${timestamp}|${rawBody}`), keys.privateKey).toString("base64") },
      { ...binding, target, commands: h.commands });
      expect(mapped.ok).toBe(true);
      if (mapped.ok) {
        const result = h.call.dispatch(mapped.event); h.commands.push(...result.commands);
        expect(h.call.dispatch(mapped.event).commands).toEqual([]);
      }
    };
    deliver("call.initiated"); deliver("call.answered");
    deliver("call.speak.ended", { status: "completed", client_state: Buffer.from(h.find("speak", "greeting").id).toString("base64") });
    deliver("call.gather.ended", { status: "valid", digits: "2", client_state: Buffer.from(h.find("collect_dtmf").id).toString("base64") });
    deliver("call.speak.ended", { status: "completed", client_state: Buffer.from(h.find("speak", "no_consent").id).toString("base64") });
    deliver("call.bridged", { call_control_id: target.controlId, call_leg_id: target.legId,
      client_state: Buffer.from(h.find("transfer").id).toString("base64") });
    expect(h.call.snapshot().routing).toBe("CONNECTED");
    deliver("call.hangup");
    expect(h.call.snapshot()).toMatchObject({ routing: "CALL_ENDED", capture: "off" });
    expect(h.find("start_transcription")).toBeUndefined();
  });
});
