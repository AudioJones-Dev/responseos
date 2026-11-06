import { createHash } from "node:crypto";

export function commandId(accountId: string, callId: string, purpose: string): string {
  const hex = createHash("sha256").update(JSON.stringify([accountId, callId, purpose])).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
export function validIndependentRoute(route: TenantCallRoute, accountId: string): boolean {
  // SIP aliases need independently verified loop analysis; this planner accepts PSTN only.
  return route.accountId === accountId && route.verifiedIndependentEndpoint &&
    /^\+[1-9]\d{7,14}$/.test(route.founderDestination) && route.forwardedNumbers.length > 0 &&
    route.forwardedNumbers.every(n => /^\+[1-9]\d{7,14}$/.test(n)) &&
    !route.forwardedNumbers.includes(route.founderDestination);
}

export type Prompt = "greeting" | "consent" | "name" | "transfer" | "no_consent" | "unavailable";
export type CommandKind = "answer" | "speak" | "collect_dtmf" | "transfer" | "bridge" | "hangup" |
  "start_recording" | "stop_recording" | "start_transcription" | "stop_transcription" | "stop_streaming";
export interface CallCommand {
  id: string;
  accountId: string;
  callId: string;
  callControlId: string;
  legId: string;
  kind: CommandKind;
  prompt?: Prompt;
}
export interface TenantCallRoute {
  accountId: string;
  founderDestination: string;
  forwardedNumbers: string[];
  verifiedIndependentEndpoint: boolean;
  founderCallControlId?: string;
}
export interface PlannedRequest {
  method: "POST";
  path: string;
  body: Record<string, unknown>;
}
export interface CallControlAdapter {
  plan(command: CallCommand, route: TenantCallRoute): PlannedRequest;
}
export type ProviderCaptureState = "off" | "start_requested" | "start_accepted" | "confirmed_synthetic" |
  "stop_requested" | "stop_accepted" | "stopped_synthetic" | "unknown";
export interface CaptureAdapter {
  confirmCaptureState(): "unknown";
}
export type RoutingState = "INBOUND_RECEIVED" | "ANSWERED" | "GREETING_PLAYED" | "CONSENT_PENDING" |
  "CONSENT_RESOLVED" | "NAME_COLLECTION" | "TRANSFER_PENDING" | "CONNECTED" | "CALL_ENDED";
export type TelemetryCode = "transition" | "duplicate" | "event_rejected" | "consent_decision" |
  "command_requested" | "command_accepted" | "command_failed" | "capture_unconfirmed" |
  "capture_observed_synthetic" | "content_rejected" | "transfer_failed" | "crm_blocked" | "topology_blocked";
export interface SafeCallTelemetry {
  correlation: string;
  code: TelemetryCode;
  routing: RoutingState;
  capture: ProviderCaptureState;
}
