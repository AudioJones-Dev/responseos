import "@/lib/serverOnlyGuard";
import { z } from "zod";
import { GROK_MODEL } from "./provider";
import { bindGrokRealtime, claimGrokMedia, dispatchGrokTermination, heartbeatGrok, requestGrokStop } from "./service";
import { matchConnectedToken, pcmu, REALTIME_URL, realtimeConfig } from "./mediaContract";
import { readDemoKnowledge } from "./demoKnowledge";

export type MediaSocket = { readonly bufferedAmount: number; send: (data: string) => void; close: () => void };
export type BridgePorts = {
  carrier: MediaSocket;
  openRealtime: (url: string, sessionId: string) => Promise<MediaSocket>;
};
const object = z.record(z.string(), z.unknown());
const identity = z.string().min(1).max(128);
const number = z.string().regex(/^\d{1,12}$/).transform(Number);
const media = z.object({ event: z.literal("media"), stream_id: z.string(), sequence_number: number, media: z.object({ track: z.literal("inbound"), chunk: number, timestamp: number, payload: z.string() }) });
export type StartupCursor = { chunk: number; timestamp: number; sequence: number };
export function startupMediaCursor(raw: string, streamId: string): StartupCursor {
  const frame = media.parse(JSON.parse(raw));
  if (frame.stream_id !== streamId || pcmu(frame.media.payload, 160).length !== 160) throw Error("startup_media_invalid");
  return { chunk: frame.media.chunk, timestamp: frame.media.timestamp, sequence: frame.sequence_number };
}
const configuration = z.object({ id: identity, model: z.literal(GROK_MODEL), tools: z.array(z.never()), resumption: z.object({ enabled: z.literal(false) }), turn_detection: z.object({ type: z.literal("server_vad") }), audio: z.object({ input: z.object({ format: z.object({ type: z.literal("audio/pcmu") }), transport: z.literal("json") }), output: z.object({ format: z.object({ type: z.literal("audio/pcmu") }), transport: z.literal("json") }) }) });

export async function startMediaBridge(input: { headers: Headers; connectedToken: unknown; rawStart: string; trusted: { streamUrl: string; publicKey: string } }, ports: BridgePorts) {
  matchConnectedToken(input.connectedToken, input.headers.get("x-telnyx-streaming-auth-token") ?? "");
  const binding = await claimGrokMedia(input.headers, input.rawStart, input.trusted);
  const id = binding.session.id, worker = binding.session.worker_token!;
  let closed = false, ready = false, configuring = false, checking = false, realtime: MediaSocket | undefined;
  let response: string | undefined, speaking = false, nextChunk = 1, lastTimestamp = -1, lastSequence = -1;
  let gapSince = 0, verifiedAt = performance.now(), lastPlayback = 0, playback = Buffer.alloc(0), serial = 0;
  const inbound = new Map<number, z.infer<typeof media>>(), marks = new Map<string, number>(), fenced = new Set<string>();
  const timers: { clock?: ReturnType<typeof setInterval> } = {};
  let stopResult: Promise<void> | undefined;
  let knowledge: ReturnType<typeof readDemoKnowledge>;
  function send(socket: MediaSocket, value: unknown) {
    if (socket.bufferedAmount > 16384) throw Error("media_backpressure");
    socket.send(JSON.stringify(value));
  }
  function fence() { ready = false; playback = Buffer.alloc(0); inbound.clear(); marks.clear(); }
  function stop(reason: string) {
    if (closed) return stopResult ?? Promise.resolve();
    closed = true; fence(); if (timers.clock) clearInterval(timers.clock);
    try { send(ports.carrier, { event: "clear" }); } catch {}
    try { realtime?.close(); } catch {}
    try { ports.carrier.close(); } catch {}
    stopResult = requestGrokStop(id, reason).then(() => dispatchGrokTermination(id));
    return stopResult;
  }
  function localGate() {
    if (closed || (binding.deadline && Date.now() >= binding.deadline.getTime()) ||
      (knowledge && Date.now() >= knowledge.expiresAt) || performance.now() - verifiedAt > 3000) throw Error("media_authority_stale");
  }
  async function check() {
    if (checking || closed) return;
    checking = true;
    try {
      if (!await heartbeatGrok(id, worker)) { await stop("media_authority_closed"); return; }
      if (!closed) verifiedAt = performance.now();
    } catch { await stop("media_database_unavailable"); }
    finally { checking = false; }
  }
  try {
    knowledge = readDemoKnowledge(binding.session.account_id);
    if (!await heartbeatGrok(id, worker)) throw Error("media_presocket_veto");
    let timer: ReturnType<typeof setTimeout> | undefined;
    const opening = ports.openRealtime(REALTIME_URL, id).then(socket => { if (closed) socket.close(); return socket; });
    realtime = await Promise.race([opening, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error("realtime_open_timeout")), 5000); })]).finally(() => { if (timer) clearTimeout(timer); });
    if (!await heartbeatGrok(id, worker)) throw Error("media_postsocket_veto");
    verifiedAt = performance.now();
    send(realtime, knowledge ? { ...realtimeConfig, session: { ...realtimeConfig.session, voice: knowledge.voice, instructions: knowledge.instructions } } : realtimeConfig);
  } catch { await stop("media_open_failed"); throw Error("media_open_failed"); }
  const openedAt = performance.now();
  async function carrier(raw: string) {
    if (closed) return;
    try {
      localGate();
      if (Buffer.byteLength(raw) > 16384) throw Error("media_frame_too_large");
      const frame = object.parse(JSON.parse(raw));
      if (frame.stream_id !== binding.streamId) throw Error("media_stream_mismatch");
      if (frame.event === "stop" || frame.event === "error") { await stop("carrier_stream_lost"); return; }
      if (frame.event === "mark") { marks.delete(z.object({ name: z.string() }).parse(frame.mark).name); return; }
      if (frame.event === "dtmf") return;
      const m = media.parse(frame), bytes = pcmu(m.media.payload, 8000);
      if (!ready) {
        nextChunk = Math.max(nextChunk, m.media.chunk + 1);
        lastTimestamp = Math.max(lastTimestamp, m.media.timestamp); lastSequence = Math.max(lastSequence, m.sequence_number);
        return;
      }
      if (bytes.length !== 160 || m.media.chunk < nextChunk || m.media.chunk > nextChunk + 5 || inbound.has(m.media.chunk)) throw Error("media_order_invalid");
      inbound.set(m.media.chunk, m);
      while (inbound.has(nextChunk)) {
        const chunk = inbound.get(nextChunk)!;
        if (chunk.media.timestamp <= lastTimestamp || chunk.sequence_number <= lastSequence) throw Error("media_order_invalid");
        localGate();
        send(realtime!, { type: "input_audio_buffer.append", audio: chunk.media.payload });
        lastTimestamp = chunk.media.timestamp; lastSequence = chunk.sequence_number;
        inbound.delete(nextChunk++);
      }
      gapSince = inbound.size ? gapSince || performance.now() : 0;
    } catch { await stop("carrier_media_invalid"); }
  }
  async function xai(raw: string) {
    if (closed) return;
    try {
      localGate();
      if (Buffer.byteLength(raw) > 16384) throw Error("realtime_frame_too_large");
      const frame = object.parse(JSON.parse(raw));
      if (frame.type === "session.created" || frame.type === "conversation.created") return;
      if (frame.type === "session.updated") {
        if (ready || configuring) throw Error("realtime_reconfiguration_denied");
        configuring = true;
        const session = configuration.parse(frame.session);
        if (knowledge && z.object({ instructions: z.literal(knowledge.instructions), voice: z.literal(knowledge.voice) }).safeParse(frame.session).success === false) throw Error("realtime_knowledge_not_acknowledged");
        await bindGrokRealtime(id, worker, session.id, knowledge && { version: knowledge.version, sha256: knowledge.sha256, instructionsSha256: knowledge.instructionsSha256, voice: knowledge.voice });
        if (closed || !await heartbeatGrok(id, worker)) { await stop("realtime_binding_closed"); return; }
        verifiedAt = performance.now(); ready = true; return;
      }
      if (!ready) throw Error("realtime_before_configuration");
      if (frame.type === "input_audio_buffer.speech_started") {
        speaking = true; if (response) fenced.add(response); response = undefined; playback = Buffer.alloc(0); marks.clear();
        send(ports.carrier, { event: "clear" }); return;
      }
      if (frame.type === "input_audio_buffer.speech_stopped") { speaking = false; return; }
      if (frame.type === "response.created") {
        const next = z.object({ id: identity }).parse(frame.response).id;
        if (speaking || fenced.has(next) || response || playback.length) throw Error("realtime_response_overlap");
        response = next; return;
      }
      if (frame.type === "response.output_audio.delta" || frame.type === "response.audio.delta") {
        const responseId = identity.parse(frame.response_id);
        if (fenced.has(responseId)) return;
        if (speaking || responseId !== response) throw Error("realtime_response_mismatch");
        const bytes = pcmu(frame.delta);
        if (playback.length + bytes.length > 8000) throw Error("realtime_audio_overflow");
        playback = Buffer.concat([playback, bytes]); return;
      }
      if (frame.type === "response.done") {
        const completed = z.object({ id: identity }).parse(frame.response).id;
        if (fenced.has(completed)) return;
        if (completed !== response) throw Error("realtime_response_mismatch");
        fenced.add(completed); response = undefined;
        if (playback.length % 160) playback = Buffer.concat([playback, Buffer.alloc(160 - playback.length % 160, 255)]);
        return;
      }
      if (typeof frame.type === "string" && ["response.output_audio.done", "response.output_audio_transcript.delta", "response.output_audio_transcript.done", "conversation.item.input_audio_transcription.completed", "input_audio_buffer.committed", "response.content_part.added", "response.content_part.done", "response.output_item.done", "conversation.item.added", "conversation.item.created"].includes(frame.type)) return;
      if (frame.type === "response.output_item.added") {
        if (z.object({ type: z.literal("message") }).safeParse(frame.item).success) return;
      }
      throw Error("realtime_event_unqualified");
    } catch { await stop("realtime_protocol_failure"); }
  }
  let nextCheck = performance.now() + 1000;
  timers.clock = setInterval(() => {
    if (closed) return;
    const now = performance.now();
    try {
      localGate();
      if ((!ready && now - openedAt > 5000) || (gapSince && now - gapSince > 100) || [...marks.values()].some(time => now - time > 1000) || fenced.size > 1000) throw Error("media_deadline");
      if (ready && playback.length >= 160 && marks.size < 5 && now - lastPlayback >= 20) {
        send(ports.carrier, { event: "media", media: { payload: playback.subarray(0, 160).toString("base64") } });
        playback = playback.subarray(160); lastPlayback = now;
        const name = `grok-${++serial}`; marks.set(name, now); send(ports.carrier, { event: "mark", mark: { name } });
      }
      if (now >= nextCheck) { nextCheck = now + 1000; void check().catch(() => {}); }
    } catch { void stop("media_deadline_or_backpressure").catch(() => {}); }
  }, 20);
  function discardStartup(cursor: StartupCursor) {
    if (closed) return;
    if (ready) throw Error("startup_discard_after_admission");
    nextChunk = Math.max(nextChunk, cursor.chunk + 1);
    lastTimestamp = Math.max(lastTimestamp, cursor.timestamp); lastSequence = Math.max(lastSequence, cursor.sequence);
  }
  return { carrier, xai, stop, discardStartup, get acceptingAudio() { return ready && !closed; }, disconnected: () => stop("media_socket_closed"), sessionId: id, disconnectionConfirmed: false as const };
}
