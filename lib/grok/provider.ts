import "@/lib/serverOnlyGuard";
import type { GrokCallSession } from "@prisma/client";

import { readQualification } from "./qualification";

export const GROK_MODEL = "grok-voice-3.0";
export type CommandResult = "accepted" | "failed" | "uncertain" | "disabled";
export type VerifiedIncoming = { eventId: string; callId: string; correlationToken: string; bodyDigest: string };
export type ControlConnection = { closed: Promise<void>; close: () => Promise<void> };

export function assertGrokQualified(): void {
  readQualification();
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

export async function handoffToGrok(session: GrokCallSession, token: string, commandId: string): Promise<CommandResult> {
  try { assertGrokQualified(); } catch { return "disabled"; }
  const { createCarrierTransport } = await import("./networkTransport");
  return createCarrierTransport({ mode: "production", apiKey: () => process.env.TELNYX_API_KEY ?? "" }).start(session, token, process.env.RESPONSEOS_GROK_STREAM_URL ?? "", commandId);
}

export async function terminateGrokCall(provider: "telnyx" | "xai", resource: string, commandId: string): Promise<CommandResult> {
  if (provider !== "telnyx") return "disabled";
  const { createCarrierTransport } = await import("./networkTransport");
  return createCarrierTransport({ mode: "production", apiKey: () => process.env.TELNYX_API_KEY ?? "" }).hangup(resource, commandId);
}

export async function connectGrokControl(_session: GrokCallSession): Promise<ControlConnection> {
  void _session;
  throw Error("grok_control_transport_disabled");
}
