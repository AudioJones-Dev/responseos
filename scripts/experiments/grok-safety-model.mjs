const targetKeys = ["accountId", "captureId", "generation", "assignmentId", "telnyxCallId", "sessionId", "legId"];

function exact(state, target) {
  if (!target || targetKeys.some(key => target[key] !== state.target[key])) throw Error("exact_target_required");
}

function stop(state, reason) {
  state.contentClosed = true;
  state.stopReason ??= reason;
}

export function createSyntheticCall(target, workerId, now, leaseMs) {
  if (!target || targetKeys.some(key => key === "generation" ? !Number.isSafeInteger(target[key]) || target[key] < 0 : typeof target[key] !== "string" || !target[key]) ||
      typeof workerId !== "string" || !workerId || !Number.isSafeInteger(now) || now < 0 || !Number.isSafeInteger(leaseMs) || leaseMs <= 0 || !Number.isSafeInteger(now + leaseMs)) throw Error("invalid_fixture");
  return {
    syntheticOnly: true, target: { ...target }, workerId, leaseMs, deadline: now + leaseMs, lastObservedAt: now,
    consent: null, handoff: "unused", xaiCallId: null, contentClosed: false,
    stopReason: null, terminationClaims: [], terminationResults: [], terminalEvidence: [], observedTermination: false,
  };
}

export function transitionSyntheticCall(previous, event, now) {
  if (previous?.syntheticOnly !== true || !Number.isSafeInteger(now) || now < previous.lastObservedAt || !Number.isSafeInteger(now + previous.leaseMs)) throw Error("invalid_fixture_clock");
  exact(previous, event.target);
  const state = structuredClone(previous);
  state.lastObservedAt = now;
  const effects = [];
  if (!state.stopReason && now >= state.deadline) stop(state, "control_lease_expired");
  switch (event.type) {
    case "consent":
      if (state.contentClosed || state.handoff !== "unused" || event.disclosureCompleted !== true || event.digit !== "1" || typeof event.grantId !== "string" || !event.grantId) throw Error("consent_not_eligible");
      state.consent = event.grantId;
      break;
    case "reserve_handoff":
      if (state.contentClosed || !state.consent || state.handoff !== "unused" || event.workerId !== state.workerId) throw Error("handoff_not_eligible");
      state.handoff = "reserved";
      break;
    case "dispatch_handoff":
      if (state.contentClosed || !state.consent || state.handoff !== "reserved" || event.workerId !== state.workerId) throw Error("handoff_not_eligible");
      state.handoff = "consumed";
      effects.push({ type: "synthetic_sip_handoff", target: { ...state.target } });
      break;
    case "bind_xai":
      if (state.handoff !== "consumed" || event.syntheticCorrelation !== "exact_fixture" || typeof event.xaiCallId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(event.xaiCallId) || (state.xaiCallId && state.xaiCallId !== event.xaiCallId)) throw Error("binding_not_eligible");
      state.xaiCallId = event.xaiCallId;
      break;
    case "heartbeat":
      if (state.contentClosed || event.workerId !== state.workerId) throw Error("worker_lease_terminal");
      state.deadline = now + state.leaseMs;
      break;
    case "withdraw": stop(state, "withdrawal"); break;
    case "control_lost":
      if (event.workerId !== state.workerId) throw Error("wrong_worker");
      stop(state, "control_lost");
      break;
    case "operator_end":
      if (event.syntheticRole !== "operator") throw Error("operator_required");
      stop(state, "operator_end");
      break;
    case "watchdog": break;
    case "termination_result":
      if (!state.terminationClaims.includes(event.commandId) || !["accepted", "failed", "uncertain"].includes(event.result)) throw Error("unknown_termination_result");
      state.terminationResults.push({ commandId: event.commandId, result: event.result });
      break;
    case "terminal_evidence":
      if (event.syntheticAuthentication !== "exact_fixture" || !["telnyx", "xai"].includes(event.provider) || (event.provider === "xai" && (!state.xaiCallId || event.callId !== state.xaiCallId)) || (event.provider === "telnyx" && event.callId !== state.target.telnyxCallId)) throw Error("terminal_evidence_mismatch");
      stop(state, "terminal_evidence");
      if (!state.terminalEvidence.includes(event.provider)) state.terminalEvidence.push(event.provider);
      break;
    case "observed_termination": state.observedTermination = true; break;
    default: throw Error("unknown_event");
  }
  if (state.stopReason) {
    for (const provider of ["telnyx", "xai"]) {
      const callId = provider === "telnyx" ? state.target.telnyxCallId : state.xaiCallId;
      const commandId = `${provider}:terminate`;
      if (!callId || state.terminalEvidence.includes(provider) || state.terminationClaims.includes(commandId)) continue;
      state.terminationClaims.push(commandId);
      effects.push({ type: "synthetic_whole_call_hangup", provider, callId, commandId, target: { ...state.target } });
    }
  }
  return { state, effects };
}

export function syntheticTerminationConfirmed(state) {
  return state.terminalEvidence.includes("telnyx") &&
    (state.handoff === "unused" || state.handoff === "reserved" || (state.xaiCallId !== null && state.terminalEvidence.includes("xai"))) &&
    state.observedTermination;
}
