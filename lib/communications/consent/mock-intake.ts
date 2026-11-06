import { isCaptureAllowed, type ConsentChoice, type ConsentParticipant } from "./contracts";
import { MockConsentCall } from "./mock";

/**
 * Mock-only call flow. This does not speak to callers or connect real call legs.
 * A real provider adapter must await successful capture command acknowledgments.
 */
export const FRL_GREETING = "Thank you for calling Florida Ramp & Lift.";
export const FRL_CONSENT_PROMPT =
  "With your permission, this call will be recorded and transcribed to document your request and coordinate follow-up. Press 1 to agree, or press 2 to continue without recording or transcription.";
export const FRL_NAME_PROMPT = "Thank you. May I have your first and last name, please?";
export const FRL_TRANSFER_PROMPT = "Thank you. Please hold while I connect your call.";
export const FRL_NO_CONSENT_PROMPT =
  "No problem. We will connect you without recording or transcription. Please hold.";

export type IntakeStage = "greeting" | "consent" | "name" | "transfer" | "connected";
export interface IntakeSnapshot {
  stage: IntakeStage;
  callerName: string | null;
  transcript: readonly string[];
  events: readonly string[];
  recordingPermitted: boolean;
  transferRequested: boolean;
}

export class MockFrlIntake {
  private call: MockConsentCall;
  private stage: IntakeStage = "greeting";
  private callerName: string | null = null;
  private events: string[] = [];
  private transferRequested = false;
  private sequence = 0;

  constructor(callId: string) {
    this.call = new MockConsentCall(callId);
  }

  greet(): string {
    if (this.stage !== "greeting") throw new Error("invalid_intake_stage");
    this.events.push("greeting_played");
    this.call.playDisclosure();
    this.stage = "consent";
    this.events.push("consent_prompt_played");
    return FRL_GREETING + " " + FRL_CONSENT_PROMPT;
  }

  /**
   * Founder approval is a separately authenticated action, not caller-supplied data.
   * Callers are offered DTMF choice; no speech recognition is required for consent.
   */
  decide(participant: ConsentParticipant, choice: ConsentChoice): void {
    if (this.stage !== "consent" && this.stage !== "name" && this.stage !== "transfer" && this.stage !== "connected") {
      throw new Error("invalid_intake_stage");
    }
    this.sequence += 1;
    this.call.decide({
      participant,
      choice,
      eventId: `mock-event-${this.sequence}`,
      occurredAt: "2026-11-06T00:00:00.000Z",
    });
    const state = this.call.getSession();
    if (state.status.caller === "declined" || state.status.caller === "timed_out" ||
        state.status.founder === "declined" || state.status.founder === "timed_out") {
      this.callerName = null;
      this.requestTransfer("without_capture");
      return;
    }
    if (state.status.caller === "revoked" || state.status.founder === "revoked") {
      this.events.push("capture_revoked");
      this.requestTransfer("without_capture");
      return;
    }
    if (isCaptureAllowed(state) && this.stage === "consent") {
      this.stage = "name";
      this.events.push("name_prompt_played");
    }
  }

  namePrompt(): string {
    if (this.stage !== "name") throw new Error("name_not_permitted");
    return FRL_NAME_PROMPT;
  }

  submitName(name: string | null): void {
    if (this.stage !== "name" || !isCaptureAllowed(this.call.getSession())) {
      throw new Error("name_capture_not_permitted");
    }
    const cleaned = name?.trim().replace(/\s+/g, " ") ?? "";
    if (cleaned && cleaned.length > 120) throw new Error("name_too_long");
    if (cleaned) {
      this.callerName = cleaned;
      this.call.ingestTranscript(`Caller name: ${cleaned}`);
      this.events.push("caller_name_captured");
    } else {
      this.events.push("caller_name_skipped");
    }
    this.requestTransfer("with_consent");
  }

  requestTransfer(reason: "with_consent" | "without_capture"): void {
    if (this.transferRequested) return;
    this.transferRequested = true;
    this.stage = "transfer";
    this.events.push(reason === "with_consent" ? "transfer_requested_consented" : "transfer_requested_no_capture");
  }

  transferPrompt(): string {
    if (this.stage !== "transfer") throw new Error("transfer_not_requested");
    return isCaptureAllowed(this.call.getSession()) ? FRL_TRANSFER_PROMPT : FRL_NO_CONSENT_PROMPT;
  }

  connected(): void {
    if (this.stage !== "transfer") throw new Error("transfer_not_requested");
    this.stage = "connected";
    this.events.push("mock_transfer_connected");
  }

  ingestConversationSegment(text: string): void {
    if (this.stage !== "connected") throw new Error("call_not_connected");
    this.call.ingestTranscript(text);
    this.events.push("conversation_segment_accepted");
  }

  snapshot(): IntakeSnapshot {
    return {
      stage: this.stage,
      callerName: this.callerName,
      transcript: this.call.getTranscript(),
      events: [...this.events, ...this.call.getEvents()],
      recordingPermitted: isCaptureAllowed(this.call.getSession()),
      transferRequested: this.transferRequested,
    };
  }
}
