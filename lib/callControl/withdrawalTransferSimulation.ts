// Executable local protocol only. No application route imports this module; it cannot dispatch provider commands.
export type SimulationBinding = {
  account: string; capture: string; generation: number; call: string; session: string; leg: string;
  conversation: string; snapshot: string; destination: string; attempt: string;
};
type Evidence = {
  kind: "synthetic_only"; binding: SimulationBinding; observedAt: number;
  assistant: "stopped" | "unknown"; transcription: "stopped" | "unknown";
  recording: "off" | "on" | "unknown"; conflicting: boolean;
};
const same = (a: SimulationBinding, b: SimulationBinding) =>
  (Object.keys(a) as (keyof SimulationBinding)[]).every(key => a[key] === b[key]);

export class WithdrawalTransferSimulation {
  readonly simulationOnly = true;
  readonly consent = "withdrawn";
  readonly contentAdmission = false;
  readonly businessEffects = false;
  readonly announcement = null;
  private readonly binding: SimulationBinding;
  private readonly withdrawalAt: number;
  private readonly expiresAt: number;
  private startedAt: number | null = null;
  private status: "idle" | "attempted" | "uncertain" | "accepted" | "connected" | "blocked" = "idle";
  constructor(binding: SimulationBinding, withdrawalAt: number, expiresAt: number) {
    if (!Number.isFinite(withdrawalAt) || !Number.isFinite(expiresAt) || expiresAt < withdrawalAt ||
      !Number.isSafeInteger(binding.generation) || binding.generation < 1 ||
      Object.entries(binding).some(([key, value]) => key !== "generation" && (typeof value !== "string" || !value.trim()))) throw new Error("invalid_simulation_authority");
    this.binding = { ...binding };
    this.withdrawalAt = withdrawalAt;
    this.expiresAt = expiresAt;
  }
  request(binding: SimulationBinding, evidence: Evidence | null, now: number) {
    if (!same(this.binding, binding)) return { status: "binding_mismatch", command: null } as const;
    if (this.status !== "idle") return { status: this.status, command: null } as const;
    if (!Number.isFinite(now) || now < this.withdrawalAt || now > this.expiresAt ||
      !evidence || evidence.kind !== "synthetic_only" || !same(this.binding, evidence.binding) ||
      !Number.isFinite(evidence.observedAt) || evidence.observedAt < this.withdrawalAt || evidence.observedAt > now ||
      evidence.conflicting || evidence.assistant !== "stopped" || evidence.transcription !== "stopped" || evidence.recording !== "off") {
      return { status: "evidence_insufficient", command: null } as const;
    }
    this.startedAt = now;
    this.status = "attempted";
    return { status: this.status, command: { simulationOnly: true, commandId: this.binding.attempt, action: "transfer", destination: this.binding.destination } } as const;
  }
  observe(binding: SimulationBinding, outcome: "lost_ack" | "accepted" | "connected" | "hangup" | "conflict", observedAt: number) {
    if (!same(this.binding, binding) || !Number.isFinite(observedAt) || observedAt < this.withdrawalAt) return false;
    if (outcome === "hangup" || outcome === "conflict") { this.status = "blocked"; return true; }
    if (this.startedAt === null || observedAt < this.startedAt || observedAt > this.expiresAt || this.status === "blocked") return false;
    if (this.status === "connected") return true;
    this.status = outcome === "connected" ? "connected" : outcome === "accepted" ? "accepted" : this.status === "accepted" ? "accepted" : "uncertain";
    return true;
  }
  result() {
    return { simulationOnly: true, attempted: this.startedAt !== null, connected: this.status === "connected", status: this.status };
  }
}
