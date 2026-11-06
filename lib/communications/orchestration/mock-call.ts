import { createHash } from "node:crypto";
import { initialCaptureState, permitsTranscript, transitionCapture, type CaptureState } from "@/lib/communications/consent/capture";
import { commandId, validIndependentRoute } from "./contracts";
import type { CallCommand, CommandKind, Prompt, ProviderCaptureState, RoutingState, SafeCallTelemetry, TelemetryCode, TenantCallRoute } from "./contracts";

export type CallInput =
  | { kind: "inbound" | "answered" | "consent_timeout" | "name_failed" | "transfer_connected" | "transfer_failed" | "hangup" | "participant_joined" | "provider_failure" | "tick" | "crm_export" }
  | { kind: "prompt_finished"; commandId: string }
  | { kind: "dtmf"; digit: string }
  | { kind: "decision"; choice: "accept" | "decline" | "timeout" | "revoke" }
  | { kind: "name_result"; name: string | null; start: string; end: string }
  | { kind: "command_result"; commandId: string; accepted: boolean }
  | { kind: "synthetic_capture_observation"; commandId: string; state: "started" | "stopped" };
export type CallInputEnvelope = CallInput & { id: string; accountId: string; callId: string; legId: string; at: string };
interface PendingCommand { command: CallCommand; at: string; outcome: "requested" | "accepted" | "failed" }
interface CallSnapshot {
  mode: "synthetic_only";
  routing: RoutingState;
  capture: ProviderCaptureState;
  consent: CaptureState;
  callerProvidedName: string | null;
  identityStatus: "unverified";
  transferOutcome: "not_attempted" | "pending" | "connected" | "failed";
  crmOutcome: "not_authorized";
}

/** Synchronous simulation only; never supplies authority to the durable ingestion boundary. */
export class MockCallOrchestrator {
  private state: CallSnapshot;
  private seen = new Map<string, string>();
  private commands = new Map<string, PendingCommand>();
  private lastRoutingTime = -Infinity;
  private phaseAt: string;
  private transferPromptFinished = false;
  private emitted: CallCommand[] = [];
  private telemetry: SafeCallTelemetry[] = [];
  private readonly correlation: string;
  private readonly context: { accountId: string; callId: string; callControlId: string; callerLegId: string; founderLegId: string; route: TenantCallRoute };

  constructor(context: { accountId: string; callId: string; callControlId: string; callerLegId: string; founderLegId: string; route: TenantCallRoute }, disclosureVersion: string, at: string, expiresAt: string) {
    if (!Number.isFinite(Date.parse(at)) || Date.parse(expiresAt) <= Date.parse(at) || context.route.accountId !== context.accountId) throw new Error("invalid_mock_session");
    this.context = structuredClone(context);
    this.phaseAt = at;
    this.correlation = createHash("sha256").update(JSON.stringify([context.accountId, context.callId])).digest("hex");
    this.state = { mode: "synthetic_only", routing: "INBOUND_RECEIVED", capture: "off",
      consent: initialCaptureState(disclosureVersion, expiresAt, [{ legId: context.callerLegId, role: "caller" }, { legId: context.founderLegId, role: "founder" }]),
      callerProvidedName: null, identityStatus: "unverified", transferOutcome: "not_attempted", crmOutcome: "not_authorized" };
  }
  snapshot(): CallSnapshot { return structuredClone(this.state); }
  private log(code: TelemetryCode) {
    this.telemetry.push({ correlation: this.correlation, code, routing: this.state.routing, capture: this.state.capture });
  }
  private route(state: RoutingState, at: string) {
    this.state.routing = state; this.phaseAt = at; this.log("transition");
  }
  private issue(kind: CommandKind, at: string, prompt?: Prompt) {
    const id = commandId(this.context.accountId, this.context.callId, `${kind}:${prompt ?? ""}`);
    if (this.commands.has(id)) return;
    const command: CallCommand = { id, accountId: this.context.accountId, callId: this.context.callId,
      callControlId: this.context.callControlId, legId: this.context.callerLegId, kind, ...(prompt ? { prompt } : {}) };
    this.commands.set(id, { command, at, outcome: "requested" });
    this.emitted.push(command); this.log("command_requested");
  }
  private authorized(at: string) {
    return !this.state.consent.revokedAt && !this.state.consent.stoppedAt && Date.parse(at) < Date.parse(this.state.consent.expiresAt) &&
      this.state.consent.participants.every(p => p.choice === "accept" && p.decidedAt && Date.parse(p.decidedAt) <= Date.parse(at));
  }
  private revoke(at: string, id: string) {
    this.state.consent = transitionCapture(this.state.consent, { id: commandId(this.context.accountId, this.context.callId, `close:${id}:${at}`), kind: "provider_failure", at });
    if (this.state.capture !== "off" && this.state.capture !== "stopped_synthetic" && this.state.capture !== "stop_requested" && this.state.capture !== "stop_accepted") {
      this.state.capture = "stop_requested";
      this.issue("stop_transcription", at);
      // Defense-in-depth cleanup; this simulator never starts recording or streaming.
      this.issue("stop_recording", at); this.issue("stop_streaming", at);
    }
  }
  private beginTransfer(at: string) {
    if (["TRANSFER_PENDING", "CONNECTED", "CALL_ENDED"].includes(this.state.routing)) return;
    const prompt: Prompt = this.authorized(at) ? "transfer" : "no_consent";
    this.revoke(at, "transfer");
    this.route("TRANSFER_PENDING", at);
    this.issue("speak", at, prompt);
  }
  private sendTransfer(at: string) {
    if (!this.transferPromptFinished || this.state.routing !== "TRANSFER_PENDING" ||
        !["off", "stopped_synthetic"].includes(this.state.capture)) return;
    if (!validIndependentRoute(this.context.route, this.context.accountId)) { this.failTransfer(at); return; }
    this.state.transferOutcome = "pending";
    this.issue("transfer", at);
  }
  private failTransfer(at: string) {
    this.state.transferOutcome = "failed"; this.log("transfer_failed");
    this.revoke(at, "transfer_failed");
    this.issue("speak", at, "unavailable");
  }
  private resolveConsent(at: string) {
    this.route("CONSENT_RESOLVED", at);
    if (!this.authorized(at)) { this.beginTransfer(at); return; }
    this.state.capture = "start_requested";
    this.issue("start_transcription", at);
  }

  dispatch(event: CallInputEnvelope): { commands: CallCommand[]; telemetry: SafeCallTelemetry[] } {
    this.emitted = []; this.telemetry = [];
    const finish = () => ({ commands: structuredClone(this.emitted), telemetry: structuredClone(this.telemetry) });
    const at = Date.parse(event.at);
    if (event.accountId !== this.context.accountId || event.callId !== this.context.callId ||
        ![this.context.callerLegId, this.context.founderLegId].includes(event.legId) || !Number.isFinite(at) ||
        !/^[A-Za-z0-9:_-]{1,160}$/.test(event.id)) { this.log("event_rejected"); return finish(); }
    const digest = createHash("sha256").update(JSON.stringify(event)).digest("hex");
    if (this.seen.has(event.id)) {
      if (this.seen.get(event.id) === digest) this.log("duplicate");
      else { this.log("event_rejected"); this.revoke(event.at, "conflicting_event"); this.beginTransfer(event.at); }
      return finish();
    }
    if (this.seen.size >= 512) {
      this.revoke(event.at, "event_limit"); this.issue("hangup", event.at); this.log("event_rejected"); return finish();
    }
    this.seen.set(event.id, digest);
    if (event.kind === "crm_export") { this.log("crm_blocked"); return finish(); }
    if (event.kind !== "decision" && event.legId !== this.context.callerLegId) { this.log("event_rejected"); return finish(); }
    if (at >= Date.parse(this.state.consent.expiresAt)) this.revoke(event.at, "expired");

    const safetyEvent = event.kind === "decision" && event.choice !== "accept" ||
      ["participant_joined", "provider_failure", "hangup", "command_result", "synthetic_capture_observation", "tick"].includes(event.kind);
    if (at < this.lastRoutingTime && !safetyEvent) { this.log("event_rejected"); return finish(); }
    if (this.state.routing === "CALL_ENDED" && !["command_result", "synthetic_capture_observation", "tick"].includes(event.kind)) return finish();
    this.lastRoutingTime = Math.max(at, this.lastRoutingTime);

    switch (event.kind) {
      case "inbound": if (this.state.routing === "INBOUND_RECEIVED") this.issue("answer", event.at); break;
      case "answered":
        if (this.state.routing === "INBOUND_RECEIVED" && [...this.commands.values()].some(c => c.command.kind === "answer")) {
          this.route("ANSWERED", event.at); this.issue("speak", event.at, "greeting");
        }
        break;
      case "prompt_finished": {
        const pending = this.commands.get(event.commandId);
        if (!pending || pending.command.kind !== "speak" || at < Date.parse(pending.at) || pending.outcome === "failed") { this.log("event_rejected"); break; }
        if (pending.command.prompt === "greeting" && this.state.routing === "ANSWERED") {
          this.route("GREETING_PLAYED", event.at); this.issue("collect_dtmf", event.at, "consent"); this.route("CONSENT_PENDING", event.at);
        } else if (["transfer", "no_consent"].includes(pending.command.prompt ?? "") && this.state.routing === "TRANSFER_PENDING") {
          this.transferPromptFinished = true; this.sendTransfer(event.at);
        } else if (pending.command.prompt === "unavailable") this.issue("hangup", event.at);
        break;
      }
      case "dtmf":
      case "consent_timeout":
        if (this.state.routing === "CONSENT_PENDING") {
          this.state.consent = transitionCapture(this.state.consent, { id: event.id, kind: "decision", at: event.at,
            legId: event.legId, choice: event.kind === "dtmf" ? (event.digit === "1" ? "accept" : "decline") : "timeout" });
          this.log("consent_decision"); this.resolveConsent(event.at);
        }
        break;
      case "decision":
        if (event.choice === "accept" && (event.legId !== this.context.founderLegId ||
            !["INBOUND_RECEIVED", "ANSWERED", "CONSENT_PENDING"].includes(this.state.routing))) { this.log("event_rejected"); break; }
        this.state.consent = transitionCapture(this.state.consent, { ...event, kind: "decision" });
        this.log("consent_decision");
        if (event.choice !== "accept") { this.revoke(event.at, event.id); this.beginTransfer(event.at); }
        break;
      case "command_result": {
        const pending = this.commands.get(event.commandId);
        if (!pending || at < Date.parse(pending.at)) { this.log("event_rejected"); break; }
        if (pending.outcome !== "requested") {
          if ((pending.outcome === "accepted") !== event.accepted) {
            this.revoke(event.at, event.id); this.state.capture = "unknown";
            this.log("capture_unconfirmed"); this.issue("hangup", event.at);
          } else this.log("duplicate");
          break;
        }
        pending.outcome = event.accepted ? "accepted" : "failed";
        this.log(event.accepted ? "command_accepted" : "command_failed");
        if (!event.accepted) {
          if (pending.command.kind.startsWith("stop_")) { this.state.capture = "unknown"; this.log("capture_unconfirmed"); this.issue("hangup", event.at); }
          else if (pending.command.kind === "transfer") this.failTransfer(event.at);
          else if (pending.command.kind === "hangup") this.log("capture_unconfirmed");
          else if (pending.command.kind === "answer" || pending.command.prompt === "unavailable") this.issue("hangup", event.at);
          else { this.revoke(event.at, event.id); this.beginTransfer(event.at); }
        } else if (pending.command.kind === "start_transcription" && this.state.capture === "start_requested" && this.authorized(event.at)) this.state.capture = "start_accepted";
        else if (pending.command.kind === "stop_transcription" && this.state.capture === "stop_requested") this.state.capture = "stop_accepted";
        break;
      }
      case "synthetic_capture_observation": {
        const pending = this.commands.get(event.commandId);
        if (!pending || at < Date.parse(pending.at) || pending.outcome === "failed") { this.log("event_rejected"); break; }
        if (event.state === "started" && pending.command.kind === "start_transcription") {
          if (!this.authorized(event.at) || this.state.routing !== "CONSENT_RESOLVED") {
            this.revoke(event.at, event.id); this.state.capture = "unknown";
            this.log("capture_unconfirmed"); this.issue("hangup", event.at); break;
          }
          this.state.consent = transitionCapture(this.state.consent, { id: event.id, at: event.at, kind: "start_ack" });
          this.state.capture = "confirmed_synthetic"; this.log("capture_observed_synthetic");
          this.route("NAME_COLLECTION", event.at); this.issue("speak", event.at, "name");
        } else if (event.state === "stopped" && pending.command.kind === "stop_transcription") {
          this.state.consent = transitionCapture(this.state.consent, { id: event.id, at: event.at, kind: "stop_ack" });
          this.state.capture = "stopped_synthetic"; this.log("capture_observed_synthetic"); this.sendTransfer(event.at);
        } else this.log("event_rejected");
        break;
      }
      case "name_result":
        if (this.state.routing !== "NAME_COLLECTION" || this.state.capture !== "confirmed_synthetic" ||
            !permitsTranscript(this.state.consent, event.legId, this.state.consent.participants.map(p => p.legId), event.start, event.end, new Date(event.at))) {
          this.log("content_rejected"); break;
        }
        this.state.callerProvidedName = event.name && event.name.trim().length <= 120 ? event.name.trim() || null : null;
        this.beginTransfer(event.at); break;
      case "name_failed": if (this.state.routing === "NAME_COLLECTION") this.beginTransfer(event.at); break;
      case "transfer_connected":
        if (this.state.routing === "TRANSFER_PENDING" && this.state.transferOutcome === "pending") {
          this.revoke(event.at, "bridge"); this.log("topology_blocked"); this.state.transferOutcome = "connected"; this.route("CONNECTED", event.at);
        }
        break;
      case "transfer_failed": if (this.state.routing === "TRANSFER_PENDING") this.failTransfer(event.at); break;
      case "participant_joined":
      case "provider_failure": this.revoke(event.at, event.id); this.log("topology_blocked"); this.beginTransfer(event.at); break;
      case "hangup": this.revoke(event.at, event.id); this.route("CALL_ENDED", event.at); break;
      case "tick": {
        const elapsed = at - Date.parse(this.phaseAt);
        const stopping = [...this.commands.values()].find(c => c.command.kind === "stop_transcription");
        if (stopping && !["off", "stopped_synthetic"].includes(this.state.capture) && at - Date.parse(stopping.at) >= 5000) {
          this.state.capture = "unknown"; this.log("capture_unconfirmed"); this.issue("hangup", event.at);
        } else if (this.state.routing === "TRANSFER_PENDING" && elapsed >= 30000) this.failTransfer(event.at);
        else if (["CONSENT_PENDING", "CONSENT_RESOLVED", "NAME_COLLECTION"].includes(this.state.routing) && (elapsed >= 15000 || at >= Date.parse(this.state.consent.expiresAt))) {
          this.revoke(event.at, event.id); this.beginTransfer(event.at);
        }
        break;
      }
    }
    return finish();
  }
}
