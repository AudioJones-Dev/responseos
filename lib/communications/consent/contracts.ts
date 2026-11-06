export type ConsentParticipant = "founder" | "caller";
export type ConsentChoice = "accept" | "decline" | "timeout" | "revoke";
export type ConsentStatus = "pending" | "accepted" | "declined" | "timed_out" | "revoked";

export interface ConsentDecision {
  participant: ConsentParticipant;
  choice: ConsentChoice;
  eventId: string;
  occurredAt: string;
}

export interface ConsentSession {
  callId: string;
  disclosureVersion: string;
  status: Record<ConsentParticipant, ConsentStatus>;
  processedEventIds: readonly string[];
  captureStarted: boolean;
  captureStopped: boolean;
}

export interface ConsentTransition {
  session: ConsentSession;
  captureAllowed: boolean;
  action: "none" | "start_capture" | "stop_capture";
}

export function createConsentSession(callId: string, disclosureVersion: string): ConsentSession {
  if (!callId || !disclosureVersion) throw new Error("missing_consent_identity");
  return {
    callId,
    disclosureVersion,
    status: { founder: "pending", caller: "pending" },
    processedEventIds: [],
    captureStarted: false,
    captureStopped: false,
  };
}

export function isCaptureAllowed(session: ConsentSession): boolean {
  return !session.captureStopped &&
    session.status.founder === "accepted" &&
    session.status.caller === "accepted";
}

export function transitionConsent(
  session: ConsentSession,
  decision: ConsentDecision,
): ConsentTransition {
  if (!decision.eventId || !decision.occurredAt || Number.isNaN(Date.parse(decision.occurredAt))) {
    throw new Error("invalid_consent_event");
  }
  if (session.processedEventIds.includes(decision.eventId)) {
    return { session, captureAllowed: isCaptureAllowed(session), action: "none" };
  }

  const previous = session.status[decision.participant];
  if (!previous) throw new Error("invalid_consent_participant");

  // Any denied or withdrawn choice is irreversible for this call; consent is call-scoped.
  if (previous === "declined" || previous === "timed_out" || previous === "revoked") {
    return { session, captureAllowed: false, action: "none" };
  }

  const beforeAllowed = isCaptureAllowed(session);
  let nextStatus: ConsentStatus;
  if (decision.choice === "accept") {
    nextStatus = previous === "accepted" ? "accepted" : "accepted";
  } else if (decision.choice === "decline") {
    nextStatus = "declined";
  } else if (decision.choice === "timeout") {
    nextStatus = "timed_out";
  } else if (decision.choice === "revoke") {
    nextStatus = "revoked";
  } else {
    throw new Error("invalid_consent_choice");
  }

  const status = { ...session.status, [decision.participant]: nextStatus };
  const denied = nextStatus === "declined" || nextStatus === "timed_out" || nextStatus === "revoked";
  const next: ConsentSession = {
    ...session,
    status,
    processedEventIds: [...session.processedEventIds, decision.eventId],
    captureStopped: session.captureStopped || (denied && session.captureStarted),
  };
  const afterAllowed = isCaptureAllowed(next);

  if (!beforeAllowed && afterAllowed) {
    const started = { ...next, captureStarted: true };
    return { session: started, captureAllowed: true, action: "start_capture" };
  }
  if (beforeAllowed && !afterAllowed) {
    return { session: next, captureAllowed: false, action: "stop_capture" };
  }
  return { session: next, captureAllowed: afterAllowed, action: "none" };
}
