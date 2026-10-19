import "@/lib/serverOnlyGuard";
import { createHash, createPublicKey, timingSafeEqual, verify } from "node:crypto";
import { z } from "zod";
import { GROK_MODEL } from "./provider";
import type { GrokCallSession } from "@prisma/client";

export const REALTIME_URL = `wss://api.x.ai/v1/realtime?model=${GROK_MODEL}`;
export const mediaClientState = (captureId: string, generation: number) => Buffer.from(JSON.stringify({ captureId, generation })).toString("base64");
export const mediaHash = (value: string) => createHash("sha256").update(value).digest("hex");
export function streamingStartBody(session: GrokCallSession, token: string, trustedUrl: string, commandId: string) {
  const url = new URL(trustedUrl);
  if (url.protocol !== "wss:" || url.username || url.password || url.hash || mediaHash(token) !== session.correlation_hash) throw Error("stream_command_invalid");
  return { command_id: commandId, stream_url: trustedUrl, stream_auth_token: token, client_state: mediaClientState(session.capture_id, session.generation), stream_track: "inbound_track", stream_codec: "PCMU", stream_bidirectional_mode: "rtp", stream_bidirectional_codec: "PCMU", stream_bidirectional_sampling_rate: 8000, stream_bidirectional_target_legs: "self" };
}
const id = z.string().min(1).max(256);
export const startFrame = z.object({ event: z.literal("start"), stream_id: id, start: z.object({ call_control_id: id, call_session_id: id, client_state: z.string().max(2048), media_format: z.object({ encoding: z.literal("PCMU"), sample_rate: z.literal(8000), channels: z.literal(1) }) }) });
export type StreamStart = z.infer<typeof startFrame>;

export function authenticateStream(headers: Headers, exactConfiguredUrl: string, publicKey: string, now = Date.now()) {
  const url = new URL(exactConfiguredUrl);
  if (url.protocol !== "wss:" || url.username || url.password || url.hash) throw Error("stream_url_invalid");
  const timestamp = headers.get("telnyx-timestamp") ?? "";
  const signature = headers.get("telnyx-signature-ed25519") ?? "";
  const token = headers.get("x-telnyx-streaming-auth-token") ?? "";
  if (!/^\d{10}$/.test(timestamp) || Math.abs(now - Number(timestamp) * 1000) > 30000 || !/^[0-9a-f]{64}$/.test(token)) throw Error("stream_auth_invalid");
  const bytes = Buffer.from(signature, "base64"), key = Buffer.from(publicKey, "base64");
  if (bytes.length !== 64 || bytes.toString("base64") !== signature || key.length !== 32) throw Error("stream_auth_invalid");
  const spki = createPublicKey({ key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), key]), format: "der", type: "spki" });
  if (!verify(null, Buffer.from(`${timestamp}|${exactConfiguredUrl}`), spki, bytes)) throw Error("stream_auth_invalid");
  return { token, tokenHash: mediaHash(token), upgradeDigest: mediaHash(`${timestamp}|${exactConfiguredUrl}|${signature}`) };
}

export function matchConnectedToken(value: unknown, token: string) {
  if (typeof value !== "string" || value.length !== token.length || !timingSafeEqual(Buffer.from(value), Buffer.from(token))) throw Error("stream_token_mismatch");
}

export const realtimeConfig = {
  type: "session.update",
  session: {
    voice: "eve", instructions: "You are a supervised demonstration voice assistant. Do not claim to book, transfer, record, send messages, or perform business actions. No tools are available.",
    tools: [], resumption: { enabled: false }, turn_detection: { type: "server_vad" },
    audio: { input: { format: { type: "audio/pcmu" }, transport: "json" }, output: { format: { type: "audio/pcmu" }, transport: "json" } },
  },
} as const;

export function pcmu(value: unknown, maxBytes = 8000): Buffer {
  if (typeof value !== "string" || value.length > Math.ceil(maxBytes / 3) * 4) throw Error("media_payload_invalid");
  const bytes = Buffer.from(value, "base64");
  if (!bytes.length || bytes.length > maxBytes || bytes.toString("base64") !== value) throw Error("media_payload_invalid");
  return bytes;
}
