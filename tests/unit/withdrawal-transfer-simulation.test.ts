import { expect, test } from "vitest";
import { WithdrawalTransferSimulation, type SimulationBinding } from "@/lib/callControl/withdrawalTransferSimulation";
const binding: SimulationBinding = { account: "synthetic", capture: "capture", generation: 1, call: "call", session: "session", leg: "leg", conversation: "conversation", snapshot: "snapshot", destination: "+15555550123", attempt: "stable-attempt" };
const proof = () => ({ kind: "synthetic_only" as const, binding: { ...binding }, observedAt: 110, assistant: "stopped" as const, transcription: "stopped" as const, recording: "off" as const, conflicting: false });
const machine = () => new WithdrawalTransferSimulation(binding, 100, 200);

test.each([[NaN, 200], [100, NaN], [Infinity, 200], [100, Infinity], [200, 100]])("invalid authority window %s/%s cannot create a simulation", (from, to) => {
  expect(() => new WithdrawalTransferSimulation(binding, from, to)).toThrow("invalid_simulation_authority");
});
test.each([{ ...binding, generation: 0 }, { ...binding, generation: 1.5 }, { ...binding, capture: " " }])("invalid binding cannot create a simulation", value => {
  expect(() => new WithdrawalTransferSimulation(value, 100, 200)).toThrow("invalid_simulation_authority");
});

test("synthetic concurrent requests emit one intent; acceptance is not connection; lost acknowledgements never blindly retry", async () => {
  const m = machine();
  const results = await Promise.all([Promise.resolve().then(() => m.request(binding, proof(), 120)), Promise.resolve().then(() => m.request(binding, proof(), 120))]);
  expect(results.filter(x => x.command)).toHaveLength(1);
  expect(results[0].command?.commandId).toBe(binding.attempt);
  m.observe(binding, "lost_ack", 121);
  expect(m.request(binding, proof(), 122).command).toBeNull();
  expect(m.result()).toMatchObject({ attempted: true, connected: false, status: "uncertain" });
  m.observe(binding, "accepted", 123);
  expect(m.result().connected).toBe(false);
  m.observe(binding, "connected", 124);
  expect(m.result().connected).toBe(true);
  expect(m.request(binding, proof(), 125).command).toBeNull();
  expect(m).toMatchObject({ consent: "withdrawn", contentAdmission: false, businessEffects: false, announcement: null });
});
test.each(Object.keys(binding) as (keyof SimulationBinding)[])("rejects mismatched %s in request and proof", key => {
  const changed = { ...binding, [key]: key === "generation" ? 2 : "wrong" };
  expect(machine().request(changed, proof(), 120).command).toBeNull();
  expect(machine().request(binding, { ...proof(), binding: changed }, 120).command).toBeNull();
});
test.each([
  null, { ...proof(), assistant: "unknown" as const }, { ...proof(), transcription: "unknown" as const },
  { ...proof(), recording: "unknown" as const }, { ...proof(), recording: "on" as const },
  { ...proof(), conflicting: true }, { ...proof(), observedAt: 99 }, { ...proof(), observedAt: 121 },
])("missing, uncertain, conflicting, stale or future cessation evidence emits no intent: %j", evidence => {
  expect(machine().request(binding, evidence, 120).command).toBeNull();
});
test.each(["hangup", "conflict"] as const)("%s permanently blocks the synthetic attempt", outcome => {
  const m = machine(); m.observe(binding, outcome, 115);
  expect(m.request(binding, proof(), 120).command).toBeNull();
  expect(m.observe(binding, "connected", 121)).toBe(false);
});
test("expired authority, out-of-order or mismatched connection cannot report connection", () => {
  expect(machine().request(binding, proof(), 201).command).toBeNull();
  const m = machine(); m.request(binding, proof(), 120);
  expect(m.observe(binding, "connected", 119)).toBe(false);
  expect(m.observe({ ...binding, generation: 2 }, "connected", 121)).toBe(false);
  expect(m.observe(binding, "connected", 201)).toBe(false);
  expect(m.result().connected).toBe(false);
});
