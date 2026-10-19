import "@/lib/serverOnlyGuard";
import type { GrokCallSession } from "@prisma/client";

export const GROK_MODEL = "grok-voice-3.0";
export type CommandResult = "accepted" | "failed" | "uncertain" | "disabled";
export type VerifiedIncoming = { eventId: string; callId: string; correlationToken: string; bodyDigest: string };
export type ControlConnection = { closed: Promise<void>; close: () => Promise<void> };

export function assertGrokQualified(): void {
  throw Error("grok_provider_contract_unqualified");
}

export function grokSelected(): boolean {
  const value = process.env.RESPONSEOS_VOICE_ENGINE;
  if (value === undefined || value === "telnyx") return false;
  if (value === GROK_MODEL) return true;
  throw Error("unknown_voice_engine");
}

export async function verifyIncomingSip(_raw: string, _headers: Headers): Promise<VerifiedIncoming> {
  void _raw; void _headers;
  throw Error("grok_signature_and_correlation_contract_unqualified");
}

export async function handoffToGrok(_session: GrokCallSession, _token: string): Promise<CommandResult> {
  void _session; void _token;
  return "disabled";
}

export async function terminateGrokCall(_provider: "telnyx" | "xai", _resource: string, _commandId: string): Promise<CommandResult> {
  void _provider; void _resource; void _commandId;
  return "disabled";
}

export async function connectGrokControl(_session: GrokCallSession): Promise<ControlConnection> {
  void _session;
  throw Error("grok_control_transport_disabled");
}
