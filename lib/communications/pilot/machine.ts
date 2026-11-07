import { randomUUID } from "node:crypto";
import type { SpeechBinding, SpeechDecision } from "./speech";

export type Role = "caller" | "operator";
export type Purpose = "monitor_name" | "monitor_conversation" | "monitor_stop" | "answer" | "keypad" | "caller_consent" | "name_prompt" | "name" | "hold" | "dial" | "operator_consent" | "bridge" | "conversation" | "stop" | "hangup" | "unavailable";
export type Leg = { controlId: string; legId: string; sessionId: string; endedAt?: number };
export type Intent = { id: string; purpose: Purpose; role: Role; createdAt: number; deadline: number };
export type Grant = { method?: "speech" | "dtmf"; role: Role; at: number; evidence: string; recording: boolean; transcription: boolean; disclosure: string };
export type Window = {
  id: string; purpose: "name" | "conversation"; roles: Role[]; authorizedAt: number;
  limitAt: number; commandId: string; recordingId?: string; startedAt?: number; endedAt?: number;
};
export type PilotState = {
  version: 1; id: string; stage: "monitor_name" | "monitor_conversation" | "pending" | "keypad" | "answer" | "caller_consent" | "name_prompt" | "name" | "hold" | "dial" | "operator_consent" | "bridge" | "conversation" | "unavailable" | "ending" | "ended";
  admission?: { caller: string; expiresAt: number; approvedAt?: number; actorId?: string };
  exercise?: "keypad" | "recorded"; digits?: string[];
  speech?: { bindings: SpeechBinding[]; monitors: Partial<Record<Role, { startedAt: number; lastAt: number }>> };
  startedAt: number; deadline: number; endsAt: number; disclosure: string;
  caller: Leg; operator?: Leg; grants: Grant[]; captureDenied: boolean; revokedAt?: number;
  windows: Window[]; intents: Intent[]; bridges: Role[]; incident?: string; dialUnknown?: boolean; topologyUnknown?: boolean;
};
export type Observation = { id: string; at: number; role: Role; token?: string } & (
  { kind: "answered" | "prompt_done" | "bridged" | "hangup" | "withdraw" | "failure" } |
  { kind: "speech_consent"; decision: SpeechDecision } | { kind: "monitor_signal"; withdraw: boolean } |
  { kind: "consent"; digit: string; valid: boolean } | { kind: "digit"; digit: string } |
  { kind: "recording"; recordingId: string; start: number; end: number; channels: string }
);
export function enqueue(s: PilotState, purpose: Purpose, role: Role, now: number): Intent {
  const i = { id: randomUUID(), purpose, role, createdAt: now, deadline: now + (purpose === "dial" ? 25000 : 15000) };
  s.intents.push(i); return i;
}
export function initialPilot(id: string, caller: Leg, now: number, closesAt: number, disclosure: string): PilotState {
  const s: PilotState = { version: 1, id, stage: "answer", startedAt: now, deadline: now + 15000,
    endsAt: Math.min(now + 300000, closesAt), disclosure, caller, grants: [], captureDenied: false, windows: [], intents: [], bridges: [] };
  enqueue(s, "answer", "caller", now); return s;
}
export function latest(s: PilotState, purpose: Purpose, role?: Role): Intent | undefined { return s.intents.findLast(i => i.purpose === purpose && (!role || i.role === role)); }
export function pendingPilot(id: string, caller: Leg, from: string, at: number, closesAt: number, disclosure: string, exercise: "keypad" | "recorded"): PilotState {
  const s = initialPilot(id, caller, at, closesAt, disclosure);
  s.stage = "pending"; s.intents = []; s.exercise = exercise;
  s.deadline = Math.min(at + 20000, closesAt);
  s.admission = { caller: from, expiresAt: s.deadline };
  return s;
}
export function approvePilot(s: PilotState, actorId: string, now: number): boolean {
  if (s.stage !== "pending" || !s.admission || s.admission.approvedAt || s.caller.endedAt || now >= s.deadline) return false;
  s.admission.approvedAt = now; s.admission.actorId = actorId;
  advance(s, "answer", "caller", now);
  s.deadline = Math.min(s.deadline, s.startedAt + 25000);
  latest(s, "answer")!.deadline = s.deadline;
  return true;
}
function advance(s: PilotState, purpose: Exclude<Purpose, "stop" | "hangup" | "monitor_stop">, role: Role, now: number, timeout = 15000) {
  s.stage = purpose;
  s.deadline = Math.min(now + timeout, s.endsAt);
  enqueue(s, purpose, role, now);
}
export function endPilot(s: PilotState, now: number, reason?: string, revoke = false): void {
  if (revoke && !s.revokedAt) s.revokedAt = now;
  if (reason) s.incident = reason;
  if (s.stage === "ended") return;
  if (s.stage !== "ending") {
    s.stage = "ending"; s.deadline = now + 10000;
    if (s.windows.some(w => !w.endedAt)) enqueue(s, "stop", "caller", now);
  }
  for (const role of ["caller", "operator"] as const) {
    if (s[role] && !s[role]?.endedAt && !s.intents.some(i => i.purpose === "hangup" && i.role === role)) enqueue(s, "hangup", role, now);
  }
  if (s.caller.endedAt && (!s.operator || s.operator.endedAt) && !s.dialUnknown && !s.topologyUnknown) s.stage = "ended";
}
function unavailable(s: PilotState, now: number) {
  advance(s, "unavailable", "caller", now);
  if (s.operator && !s.operator.endedAt && !s.intents.some(i => i.role === "operator" && i.purpose === "hangup")) enqueue(s, "hangup", "operator", now);
}
function prepareCapture(s: PilotState, purpose: "name" | "conversation", now: number) {
  if (!s.speech) return beginCapture(s, purpose, now);
  const stage = purpose === "name" ? "monitor_name" : "monitor_conversation";
  s.stage = stage; s.deadline = Math.min(now + 15000, s.endsAt);
  for (const role of (purpose === "name" ? ["caller"] : ["caller", "operator"]) as Role[]) {
    if (!s.speech.monitors[role]) enqueue(s, stage, role, now);
  }
}
export function acceptPilotCommand(s: PilotState, i: Intent, now: number) {
  if (!s.speech) return;
  if (i.purpose === "monitor_stop") { delete s.speech.monitors[i.role]; return; }
  if (i.purpose !== "monitor_name" && i.purpose !== "monitor_conversation") return;
  if (s.stage !== i.purpose || !s.grants.some(g => g.role === i.role && g.recording && g.transcription) || s.captureDenied || s.revokedAt) {
    endPilot(s, now, "speech_monitor_authority_missing", true); return;
  }
  s.speech.monitors[i.role] = { startedAt: now, lastAt: now };
  if (i.purpose === "monitor_name" || s.speech.monitors.caller && s.speech.monitors.operator) beginCapture(s, i.purpose === "monitor_name" ? "name" : "conversation", now);
}
function beginCapture(s: PilotState, purpose: "name" | "conversation", now: number) {
  const roles: Role[] = purpose === "name" ? ["caller"] : ["caller", "operator"];
  if (s.captureDenied || s.revokedAt || !roles.every(role => s.grants.some(g => g.role === role && g.recording && g.transcription))) {
    endPilot(s, now, "capture_authority_missing", true); return;
  }
  advance(s, purpose, "caller", now, purpose === "name" ? 20000 : s.endsAt - now);
  const command = latest(s, purpose)!;
  s.windows.push({ id: randomUUID(), purpose, roles, authorizedAt: now,
    limitAt: Math.min(now + (purpose === "name" ? 10000 : 300000), s.endsAt), commandId: command.id });
}
export function observePilot(state: PilotState, e: Observation, receivedAt: number): PilotState {
  const s = structuredClone(state);
  if (!s[e.role] || e.at < s.startedAt || e.at > receivedAt + 2000) return s;
  if (s.exercise === "keypad" && s.stage === "keypad" && e.kind === "digit" && e.role === "caller" && e.token === latest(s, "keypad")?.id) {
    s.digits ??= [];
    if (["1", "2", "*"].includes(e.digit) && !s.digits.includes(e.digit)) s.digits.push(e.digit);
    if (e.digit === "*") endPilot(s, receivedAt);
    return s;
  }
  if (e.kind === "monitor_signal") {
    const monitor = s.speech?.monitors[e.role];
    if (!monitor || e.at < monitor.startedAt || !s.grants.some(g => g.role === e.role && g.recording && g.transcription)) return s;
    monitor.lastAt = Math.max(monitor.lastAt, e.at);
    if (e.withdraw) endPilot(s, receivedAt, "consent_withdrawn", true);
    return s;
  }
  if (e.kind === "withdraw") { endPilot(s, receivedAt, "consent_withdrawn", true); return s; }
  if (e.kind === "hangup") {
    s[e.role]!.endedAt = e.at;
    if (e.role === "operator" && ["dial", "operator_consent"].includes(s.stage)) { unavailable(s, receivedAt); return s; }
    endPilot(s, receivedAt); return s;
  }
  if (e.kind === "failure") { endPilot(s, receivedAt, "provider_failure", true); return s; }
  if (e.kind === "recording") {
    const w = s.windows.find(w => w.commandId === e.token && !w.recordingId);
    if (!w || e.role !== "caller") return s;
    const terminal = Math.min(...w.roles.map(role => s[role]?.endedAt ?? Infinity));
    if (s.revokedAt || e.start < w.authorizedAt || e.end <= e.start || e.end > e.at || e.end > w.limitAt || e.end > terminal ||
        (w.purpose === "conversation" && e.channels !== "dual") || s.windows.some(x => x.recordingId === e.recordingId)) {
      endPilot(s, receivedAt, "recording_interval_unproven", true); return s;
    }
    w.recordingId = e.recordingId; w.startedAt = e.start; w.endedAt = e.end;
    if (s.stage === "name" && w.purpose === "name") {
      advance(s, "hold", "caller", receivedAt);
    }
    return s;
  }
  if (s.stage === "ending" || s.stage === "ended" || receivedAt >= s.endsAt) return s;
  if (s.stage === "pending") return s;
  const expected = latest(s, s.stage);
  if (e.kind === "answered" && s.stage === "dial" && e.role === "operator") {
    if (e.token === latest(s, "dial")?.id) advance(s, "operator_consent", "operator", receivedAt, 60000);
    return s;
  }
  if (e.kind === "bridged") {
    // The opposite leg retains its own client state; both independently bound legs must report the bridge.
    const token = e.role === "caller" ? latest(s, "bridge")?.id : latest(s, "operator_consent")?.id;
    if (s.stage !== "bridge" || e.token !== token || e.at < (latest(s, "bridge")?.createdAt ?? Infinity)) {
      s.topologyUnknown = true;
      endPilot(s, receivedAt, "unexpected_topology", true); return s;
    }
    if (!s.bridges.includes(e.role)) s.bridges.push(e.role);
    if (s.bridges.length === 2) {
      if (s.captureDenied) { s.stage = "conversation"; s.deadline = s.endsAt; }
      else prepareCapture(s, "conversation", receivedAt);
    }
    return s;
  }
  if (!expected || expected.id !== e.token || e.at < expected.createdAt) return s;
  if (s.stage === "answer" && e.kind === "answered" && e.role === "caller") advance(s, s.exercise === "keypad" ? "keypad" : "caller_consent", "caller", receivedAt, 60000);
  else if ((e.kind === "consent" && !s.speech || e.kind === "speech_consent" && !!s.speech) && ((s.stage === "caller_consent" && e.role === "caller") || (s.stage === "operator_consent" && e.role === "operator"))) {
    if (e.kind === "speech_consent" && e.decision === "withdraw") { endPilot(s, receivedAt, "consent_withdrawn", true); return s; }
    const grant = e.kind === "speech_consent" ? e.decision === "agree" : e.kind === "consent" && e.valid && e.digit === "1";
    s.grants.push({ method: e.kind === "speech_consent" ? "speech" : "dtmf", role: e.role, at: e.at, evidence: e.id, recording: grant, transcription: grant, disclosure: s.disclosure });
    if (!grant) {
      s.captureDenied = true;
      if (s.speech) for (const role of ["caller", "operator"] as const) {
        if (s.speech.monitors[role]) enqueue(s, "monitor_stop", role, receivedAt);
      }
    }
    if (e.role === "caller") advance(s, grant ? "name_prompt" : "hold", "caller", receivedAt);
    else if (e.kind === "speech_consent" ? ["agree", "decline_capture"].includes(e.decision) : e.kind === "consent" && e.valid && ["1", "2"].includes(e.digit)) advance(s, "bridge", "caller", receivedAt);
    else unavailable(s, receivedAt);
  } else if (e.kind === "prompt_done" && e.role === "caller") {
    if (s.stage === "name_prompt") prepareCapture(s, "name", receivedAt);
    else if (s.stage === "hold") advance(s, "dial", "operator", receivedAt, 30000);
    else if (s.stage === "unavailable") endPilot(s, receivedAt);
  }
  return s;
}
export function tickPilot(state: PilotState, now: number, enabled: boolean): PilotState {
  const s = structuredClone(state);
  if (s.stage === "ended") return s;
  if (!enabled || now >= s.endsAt) { endPilot(s, now, enabled ? "call_limit" : "dispatch_closed", !enabled); return s; }
  if (s.stage !== "ending" && s.speech && Object.values(s.speech.monitors).some(m => now - m.lastAt >= 15000)) {
    endPilot(s, now, "speech_monitor_silent_or_failed", true); return s;
  }
  if (now < s.deadline) return s;
  if (s.stage === "caller_consent") {
    s.grants.push({ method: s.speech ? "speech" : "dtmf", role: "caller", at: now, evidence: "controller:consent_timeout", recording: false, transcription: false, disclosure: s.disclosure });
    s.captureDenied = true; advance(s, "hold", "caller", now);
  } else if (s.stage === "dial" || s.stage === "operator_consent") {
    unavailable(s, now);
  } else if (s.stage === "ending") s.incident ??= "termination_unconfirmed";
  else endPilot(s, now, "stage_timeout", s.windows.some(w => !w.endedAt));
  return s;
}
export function commandAllowed(s: PilotState, i: Intent, now: number): boolean {
  if (i.purpose === "hangup" || i.purpose === "stop" || i.purpose === "monitor_stop") return !s[i.role]?.endedAt;
  if (s.admission && !s.admission.approvedAt) return false;
  if (s.exercise === "keypad" && !["answer", "keypad"].includes(i.purpose)) return false;
  if (now >= i.deadline || now >= s.endsAt || s.stage !== i.purpose || latest(s, i.purpose, i.role)?.id !== i.id) return false;
  if (i.purpose === "monitor_name" || i.purpose === "monitor_conversation") return !!s.speech && !s.captureDenied && !s.revokedAt && s.grants.some(g => g.role === i.role && g.recording && g.transcription);
  if (i.purpose === "name" || i.purpose === "conversation") return !s.captureDenied && !s.revokedAt && s.windows.some(w => w.commandId === i.id && now + 1000 < w.limitAt);
  return true;
}
