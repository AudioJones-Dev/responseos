import { z } from "zod";

const id = z.string().regex(/^[A-Za-z0-9:_-]{1,200}$/);
const time = z.iso.datetime({ offset: true });
const participant = z.object({
  legId: id, role: z.enum(["caller", "founder", "additional"]),
  choice: z.enum(["pending", "accept", "decline", "timeout", "revoke"]),
  decidedAt: time.nullable(),
}).strict();
export const captureStateSchema = z.object({
  disclosureVersion: id,
  scope: z.literal("transcription"), recordingPermitted: z.literal(false),
  participants: z.array(participant).min(2).max(16),
  expiresAt: time,
  startedAt: time.nullable(), stoppedAt: time.nullable(), revokedAt: time.nullable(),
  stopAcknowledged: z.boolean(),
  events: z.array(z.object({ id, kind: id, at: time, legId: id.optional(), choice: z.enum(["accept", "decline", "timeout", "revoke"]).optional() }).strict()),
}).strict().refine(state => new Set(state.participants.map(p => p.legId)).size === state.participants.length &&
  state.participants.filter(p => p.role === "caller").length === 1 && state.participants.filter(p => p.role === "founder").length === 1,
  "invalid_capture_roster");
export type CaptureState = z.infer<typeof captureStateSchema>;
export const captureEventSchema = z.discriminatedUnion("kind", [
  z.object({ id, at: time, kind: z.literal("decision"), legId: id, choice: z.enum(["accept", "decline", "timeout", "revoke"]) }).strict(),
  z.object({ id, at: time, kind: z.enum(["start_ack", "stop_ack", "stop_failed", "provider_failure", "transfer_failed", "participant_joined"]) }).strict(),
]);
export type CaptureEvent = z.infer<typeof captureEventSchema>;

export function initialCaptureState(disclosureVersion: string, expiresAt: string, legs: { legId: string; role: "caller" | "founder" | "additional" }[]): CaptureState {
  if (new Set(legs.map(p => p.legId)).size !== legs.length ||
      !legs.some(p => p.role === "caller") || !legs.some(p => p.role === "founder")) throw new Error("invalid_capture_roster");
  return captureStateSchema.parse({ disclosureVersion, expiresAt, scope: "transcription", recordingPermitted: false,
    participants: legs.map(p => ({ ...p, choice: "pending", decidedAt: null })),
    startedAt: null, stoppedAt: null, revokedAt: null, stopAcknowledged: false, events: [],
  });
}

export function transitionCapture(state: CaptureState, event: CaptureEvent): CaptureState {
  const previous = state.events.find(e => e.id === event.id);
  if (previous) {
    if (previous.kind !== event.kind || previous.at !== event.at ||
        (event.kind === "decision" && (previous.legId !== event.legId || previous.choice !== event.choice))) throw new Error("conflicting_capture_event");
    return state;
  }
  const next: CaptureState = structuredClone(state);
  next.events.push({ id: event.id, kind: event.kind, at: event.at, ...(event.kind === "decision" ? { legId: event.legId, choice: event.choice } : {}) });
  if (next.events.length >= 256) next.revokedAt ??= event.at;
  if (event.kind === "decision") {
    const p = next.participants.find(p => p.legId === event.legId);
    if (!p) throw new Error("unknown_capture_participant");
    if (event.choice !== "accept") {
      p.choice = event.choice;
      p.decidedAt = event.at;
      next.revokedAt = next.revokedAt && Date.parse(next.revokedAt) < Date.parse(event.at) ? next.revokedAt : event.at;
    } else if (!next.revokedAt && p.choice === "pending" && !next.startedAt) {
      p.choice = "accept";
      p.decidedAt = event.at;
    }
  } else if (event.kind === "start_ack") {
    if (next.revokedAt || next.startedAt || Date.parse(event.at) >= Date.parse(next.expiresAt) ||
        next.participants.some(p => p.choice !== "accept" || !p.decidedAt || Date.parse(p.decidedAt) > Date.parse(event.at))) {
      throw new Error("capture_start_not_authorized");
    }
    next.startedAt = event.at;
  } else {
    next.revokedAt ??= event.at;
    if (event.kind === "stop_ack") {
      if (next.startedAt && Date.parse(event.at) < Date.parse(next.startedAt)) throw new Error("invalid_stop_ack");
      next.stoppedAt = event.at;
      next.stopAcknowledged = true;
    }
  }
  return next;
}

export function permitsTranscript(state: CaptureState, legId: string, participantLegIds: string[], start: string, end: string, now: Date): boolean {
  const from = Date.parse(start), to = Date.parse(end);
  return !state.revokedAt && !state.stoppedAt && !!state.startedAt &&
    Number.isFinite(from) && Number.isFinite(to) && from <= to &&
    from >= Date.parse(state.startedAt) && to < Date.parse(state.expiresAt) &&
    to <= now.getTime() && now.getTime() < Date.parse(state.expiresAt) &&
    state.participants.every(p => p.choice === "accept" && p.decidedAt && Date.parse(p.decidedAt) <= from) &&
    state.participants.some(p => p.legId === legId) &&
    participantLegIds.length === state.participants.length && new Set(participantLegIds).size === participantLegIds.length &&
    state.participants.every(p => participantLegIds.includes(p.legId));
}
