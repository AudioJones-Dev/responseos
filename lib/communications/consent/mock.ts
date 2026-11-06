import {
  createConsentSession,
  isCaptureAllowed,
  transitionConsent,
  type ConsentDecision,
  type ConsentSession,
} from "./contracts";

export type MockCaptureEvent = "disclosure_played" | "capture_started" | "capture_stopped" | "transcript_accepted";

export class MockConsentCall {
  private state: ConsentSession;
  private events: MockCaptureEvent[] = [];
  private segments: string[] = [];

  constructor(callId: string, disclosureVersion = "mock-disclosure-v1") {
    this.state = createConsentSession(callId, disclosureVersion);
  }

  playDisclosure(): void {
    this.events.push("disclosure_played");
  }

  decide(decision: ConsentDecision): void {
    const result = transitionConsent(this.state, decision);
    this.state = result.session;
    if (result.action === "start_capture") this.events.push("capture_started");
    if (result.action === "stop_capture") this.events.push("capture_stopped");
  }

  ingestTranscript(text: string): void {
    if (!isCaptureAllowed(this.state)) throw new Error("consent_required");
    this.segments.push(text);
    this.events.push("transcript_accepted");
  }

  getSession(): ConsentSession {
    return {
      ...this.state,
      status: { ...this.state.status },
      processedEventIds: [...this.state.processedEventIds],
    };
  }

  getEvents(): readonly MockCaptureEvent[] {
    return [...this.events];
  }

  getTranscript(): readonly string[] {
    return [...this.segments];
  }
}
