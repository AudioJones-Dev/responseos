import { createHash, createHmac, generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { createServer as httpsServer } from "node:https";
import { createServer as netServer, type AddressInfo } from "node:net";
import WebSocket, { WebSocketServer } from "ws";
import { once } from "node:events";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { prisma, resetAndSeedTestDb, disconnectTestDb, setDevSession } from "./setup";
import { db } from "@/lib/db/client";
import * as operatorService from "@/lib/callReview/service";
import * as grokService from "@/lib/grok/service";
import { recordWebhookEvent } from "@/lib/data/webhookEvents";
import { persistWithdrawalReceipt, withdrawalReceiptDb } from "@/lib/callReview/withdrawalReceipt";
import { beginGrokHandoff, acceptGrokIncoming, claimGrokWorker, heartbeatGrok, requestGrokStop, dispatchGrokTermination, watchdogGrokSweep } from "@/lib/grok/service";
import { POST as consentPost } from "@/app/api/admin/call-capture/[id]/consent/route";
import { POST as endPost } from "@/app/api/admin/call-capture/[id]/end-call/route";
import { GET as statusGet } from "@/app/api/admin/call-capture/[id]/grok/route";
import { POST as incomingPost } from "@/app/api/webhooks/xai/sip/route";
import { claimGrokMedia, bindGrokRealtime } from "@/lib/grok/service";
import { mediaClientState, realtimeConfig, REALTIME_URL } from "@/lib/grok/mediaContract";
import { startMediaBridge } from "@/lib/grok/mediaBridge";
import { createGrokMediaServer } from "@/lib/grok/mediaServer";
import { createCarrierTransport } from "@/lib/grok/networkTransport";

const transport = vi.hoisted(() => { vi.resetModules(); return { handoff: vi.fn(), terminate: vi.fn(), verify: vi.fn(), qualified: vi.fn(), operatorEnd: vi.fn() }; });
vi.mock("@/lib/providers/telnyx/callControl", async original => ({ ...await original<typeof import("@/lib/providers/telnyx/callControl")>(), sendTelnyxCallCommand: transport.operatorEnd }));
vi.mock("@/lib/grok/provider", async original => ({ ...await original<typeof import("@/lib/grok/provider")>(), assertGrokQualified: transport.qualified, handoffToGrok: transport.handoff, terminateGrokCall: transport.terminate, verifyIncomingSip: transport.verify }));
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const syntheticMac = (s: string) => createHmac("sha256", "local-test-only-not-provider-signing").update(s).digest("hex");
let tlsDirectory: string, tls: { key: Buffer; cert: Buffer };
beforeAll(() => {
  tlsDirectory = mkdtempSync(path.join(tmpdir(), "grok-tls-"));
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", path.join(tlsDirectory, "key.pem"), "-out", path.join(tlsDirectory, "cert.pem"), "-days", "1", "-subj", "/CN=127.0.0.1", "-addext", "subjectAltName=IP:127.0.0.1"], { stdio: "ignore" });
  tls = { key: readFileSync(path.join(tlsDirectory, "key.pem")), cert: readFileSync(path.join(tlsDirectory, "cert.pem")) };
});
afterAll(() => { if (tlsDirectory && path.dirname(tlsDirectory) === path.resolve(tmpdir()) && path.basename(tlsDirectory).startsWith("grok-tls-")) rmSync(tlsDirectory, { recursive: true }); });

async function unusedPort() {
  const server = netServer(); server.listen(0, "127.0.0.1"); await once(server, "listening");
  const port = (server.address() as AddressInfo).port; await new Promise<void>(resolve => server.close(() => resolve())); return port;
}

async function networkFixture(malformedCarrierResponse = false) {
  const f = await fixture(), requests: { url: string; body: Record<string, unknown>; authorization: string | undefined; consentSaved: boolean }[] = [];
  const sessions: WebSocket[] = [], audio: string[] = [], urls: string[] = [];
  const peer = httpsServer(tls, (request, response) => {
    let raw = ""; request.on("data", bytes => { raw += bytes.toString(); });
    request.on("end", () => { void (async () => {
      const consentSaved = (await prisma.callConsentEvent.count({ where: { account_id: f.capture.account_id, provider_call_id: f.capture.provider_call_id, action: "grant" } })) > 0;
      requests.push({ url: request.url!, body: JSON.parse(raw), authorization: request.headers.authorization, consentSaved });
      response.writeHead(200, { "Content-Type": "application/json" }); response.end(malformedCarrierResponse ? "not-json" : JSON.stringify({ data: { result: "ok" } }));
    })().catch(() => { response.writeHead(500); response.end(); }); });
  });
  const xai = new WebSocketServer({ server: peer, path: "/v1/realtime", perMessageDeflate: false });
  xai.on("connection", (socket, request) => {
    sessions.push(socket); urls.push(request.url!);
    socket.on("error", () => {});
    socket.on("message", raw => {
      const frame = JSON.parse(raw.toString());
      if (frame.type === "session.update") socket.send(JSON.stringify({ type: "session.updated", session: { ...frame.session, id: `session_${randomUUID()}`, model: "grok-voice-3.0" } }));
      if (frame.type === "input_audio_buffer.append") {
        audio.push(frame.audio);
        socket.send(JSON.stringify({ type: "response.created", response: { id: "response_local" } }));
        socket.send(JSON.stringify({ type: "response.output_audio.delta", response_id: "response_local", delta: Buffer.alloc(320, 255).toString("base64") }));
        socket.send(JSON.stringify({ type: "response.done", response: { id: "response_local" } }));
      }
    });
    socket.send(JSON.stringify({ type: "session.created", session: { id: "initial" } }));
  });
  peer.listen(0, "127.0.0.1"); await once(peer, "listening");
  const peerOrigin = `https://127.0.0.1:${(peer.address() as AddressInfo).port}`;
  const carrierTransport = createCarrierTransport({ mode: "local-synthetic", origin: peerOrigin, ca: tls.cert });
  const keys = generateKeyPairSync("ed25519"), port = await unusedPort(), streamUrl = `wss://127.0.0.1:${port}/media?version=1`;
  const runtime = createGrokMediaServer({ streamUrl, publicKey: keys.publicKey.export({ format: "der", type: "spki" }).subarray(-32).toString("base64"), tls, realtime: { mode: "local-synthetic", origin: peerOrigin, ca: tls.cert } });
  runtime.server.listen(port, "127.0.0.1"); await once(runtime.server, "listening");
  transport.handoff.mockImplementation((session, token, commandId) => carrierTransport.start(session, token, streamUrl, commandId));
  transport.terminate.mockImplementation((provider, call, commandId) => provider === "telnyx" ? carrierTransport.hangup(call, commandId) : "disabled");
  transport.operatorEnd.mockImplementation(async ({ callControlId, body }) => ({ ok: await carrierTransport.hangup(callControlId, body.command_id) === "accepted", status: 200, errorCode: null, providerDate: null }));
  const started = await beginGrokHandoff(f.capture), token = requests[0].body.stream_auth_token as string;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const headers = { "telnyx-timestamp": timestamp, "telnyx-signature-ed25519": sign(null, Buffer.from(`${timestamp}|${streamUrl}`), keys.privateKey).toString("base64"), "x-telnyx-streaming-auth-token": token };
  const streamId = randomUUID(), received: Record<string, unknown>[] = [];
  async function connect(extraHeaders = {}, ca = tls.cert) {
    const socket = new WebSocket(streamUrl, { ca, rejectUnauthorized: true, headers: { ...headers, ...extraHeaders }, perMessageDeflate: false });
    socket.on("message", raw => {
      const frame = JSON.parse(raw.toString()); received.push(frame);
      if (frame.event === "mark") socket.send(JSON.stringify({ ...frame, stream_id: streamId }));
    });
    await once(socket, "open");
    socket.send(JSON.stringify({ event: "connected", version: "1.0.0", "x-telnyx-streaming-auth-token": token }));
    socket.send(JSON.stringify({ event: "start", stream_id: streamId, start: { call_control_id: f.capture.provider_call_id, call_session_id: f.capture.call_session_id, client_state: mediaClientState(f.capture.id, f.capture.generation), media_format: { encoding: "PCMU", sample_rate: 8000, channels: 1 } } }));
    return socket;
  }
  const ready = () => vi.waitFor(async () => expect(await prisma.grokIncomingReceipt.count({ where: { session_id: started.sessionId, event_id: { startsWith: "realtime:" } } })).toBe(1), { timeout: 4000 });
  async function close() { await runtime.close(); for (const socket of sessions) socket.terminate(); await new Promise<void>(resolve => xai.close(() => resolve())); await new Promise<void>(resolve => peer.close(() => resolve())); }
  return { ...f, id: started.sessionId, requests, sessions, audio, urls, received, connect, ready, close, streamId };
}

test("real local TLS sockets carry post-consent PCMU and operator End call reaches exact carrier HTTP target", async () => {
  const f = await networkFixture();
  try {
    const caller = await f.connect(); await f.ready();
    caller.send(JSON.stringify({ event: "media", stream_id: f.streamId, sequence_number: "2", media: { track: "inbound", chunk: "1", timestamp: "20", payload: Buffer.alloc(160, 255).toString("base64") } }));
    await vi.waitFor(() => expect(f.received.filter(frame => frame.event === "media")).toHaveLength(2));
    expect(f.audio).toHaveLength(1); expect(f.urls).toEqual(["/v1/realtime?model=grok-voice-3.0"]);
    expect(f.requests[0].consentSaved).toBe(true); expect(f.requests[0].authorization).toBe("Bearer local-synthetic-only");
    expect(f.requests[0].url).toBe(`/v2/calls/${encodeURIComponent(f.capture.provider_call_id)}/actions/streaming_start`);
    expect(f.requests[0].body).toMatchObject({ stream_track: "inbound_track", stream_bidirectional_target_legs: "self", stream_bidirectional_codec: "PCMU", stream_bidirectional_sampling_rate: 8000 });
    const closed = once(caller, "close");
    const response = await endPost(new Request("http://localhost", { method: "POST", body: JSON.stringify({ expectedAccountId: f.capture.account_id, expectedProviderCallId: f.capture.provider_call_id, generation: f.capture.generation }) }), { params: Promise.resolve({ id: f.capture.id }) });
    expect(response.status).toBe(202); await closed;
    expect(f.requests.filter(r => r.url.endsWith("/hangup"))).toHaveLength(1);
    expect(f.requests.at(-1)!.url).toBe(`/v2/calls/${encodeURIComponent(f.capture.provider_call_id)}/actions/hangup`);
    expect((await prisma.callCaptureSession.findUniqueOrThrow({ where: { id: f.capture.id } })).call_disconnected_at).toBeNull();
  } finally { await f.close(); }
});

test("real WSS listener rejects forged upgrade before xAI socket creation", async () => {
  const f = await networkFixture();
  try { await expect(f.connect({ "telnyx-signature-ed25519": Buffer.alloc(64).toString("base64") })).rejects.toThrow(); expect(f.sessions).toHaveLength(0); }
  finally { await f.close(); }
});

test.each(["claim", "configuration"])("real startup audio during delayed %s is discarded without filling the control queue or replay", async stage => {
  const f = await networkFixture();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const claimed = grokService.claimGrokMedia, configured = grokService.bindGrokRealtime;
  const spy = stage === "claim"
    ? vi.spyOn(grokService, "claimGrokMedia").mockImplementation(async (...args) => { await gate; return claimed(...args); })
    : vi.spyOn(grokService, "bindGrokRealtime").mockImplementation(async (...args) => { await gate; return configured(...args); });
  try {
    const caller = await f.connect();
    await vi.waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    const packet = (chunk: number, value: number) => JSON.stringify({ event: "media", stream_id: f.streamId, sequence_number: String(chunk + 1), media: { track: "inbound", chunk: String(chunk), timestamp: String(chunk * 20), payload: Buffer.alloc(160, value).toString("base64") } });
    for (let chunk = 1; chunk <= 100; chunk++) { caller.send(packet(chunk, 17)); await new Promise(resolve => setTimeout(resolve, 20)); }
    expect(caller.readyState).toBe(WebSocket.OPEN); expect(f.audio).toHaveLength(0);
    release(); await f.ready();
    caller.send(packet(101, 34));
    await vi.waitFor(() => expect(f.audio).toHaveLength(1));
    expect(Buffer.from(f.audio[0], "base64")).toEqual(Buffer.alloc(160, 34));
    expect(caller.readyState).toBe(WebSocket.OPEN);
  } finally { release(); spy.mockRestore(); await f.close(); }
});

test("real local TLS rejects an untrusted certificate without opening xAI", async () => {
  const f = await networkFixture();
  try { await expect(f.connect({}, Buffer.from("not-a-trusted-ca"))).rejects.toThrow(); expect(f.sessions).toHaveLength(0); }
  finally { await f.close(); }
});

test("malformed real carrier HTTP result remains uncertain and cannot release a consumed command", async () => {
  const f = await networkFixture(true);
  try {
    expect((await prisma.grokCallCommand.findFirstOrThrow({ where: { session_id: f.id, kind: "handoff" } })).status).toBe("uncertain");
    await expect(beginGrokHandoff(f.capture)).rejects.toThrow("grok_handoff_consumed");
    await watchdogGrokSweep(); await watchdogGrokSweep();
    expect(f.requests).toHaveLength(2); expect(f.sessions).toHaveLength(0);
    expect((await prisma.grokCallCommand.findFirstOrThrow({ where: { session_id: f.id, kind: "telnyx_hangup" } })).status).toBe("uncertain");
  } finally { await f.close(); }
});

test("real socket replay cannot join an already consumed stream", async () => {
  const f = await networkFixture();
  try {
    const caller = await f.connect(); await f.ready(); const duplicate = await f.connect(); await once(duplicate, "close");
    expect(f.sessions).toHaveLength(1); expect(caller.readyState).toBe(WebSocket.OPEN);
  } finally { await f.close(); }
});

test.each(["network-loss", "binary-frame", "withdrawal"])("real socket %s closes admission and requests exact hangup without terminal proof", async fault => {
  const f = await networkFixture();
  try {
    const caller = await f.connect(); await f.ready(); const closed = once(caller, "close");
    if (fault === "network-loss") f.sessions[0].terminate();
    if (fault === "binary-frame") caller.send(Buffer.alloc(20000));
    if (fault === "withdrawal") await f.receipt();
    await closed;
    await vi.waitFor(() => expect(f.requests.filter(r => r.url.endsWith("/hangup"))).toHaveLength(1), { timeout: 4000 });
    expect((await prisma.grokCallSession.findUniqueOrThrow({ where: { id: f.id } })).stopped_at).not.toBeNull();
    expect((await prisma.callCaptureSession.findUniqueOrThrow({ where: { id: f.capture.id } })).call_disconnected_at).toBeNull();
  } finally { await f.close(); }
});
beforeEach(async () => {
  await resetAndSeedTestDb(); setDevSession("operator");
  transport.qualified.mockReset(); transport.handoff.mockReset().mockResolvedValue("accepted"); transport.terminate.mockReset().mockResolvedValue("accepted");
  transport.operatorEnd.mockReset().mockResolvedValue({ ok: true, status: 200, errorCode: null, providerDate: null });
  transport.verify.mockReset().mockImplementation(async (raw: string, headers: Headers) => {
    if (headers.get("x-synthetic-signature") !== syntheticMac(raw)) throw Error("unverified_fixture");
    const payload = JSON.parse(raw);
    return { ...payload, bodyDigest: hash(raw) };
  });
  vi.stubGlobal("fetch", vi.fn(() => { throw Error("network_forbidden"); }));
});
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
afterAll(async () => { await withdrawalReceiptDb?.$disconnect(); await disconnectTestDb(); vi.doUnmock("@/lib/grok/provider"); vi.doUnmock("@/lib/providers/telnyx/callControl"); vi.resetModules(); });
async function fixture() {
  const account = await prisma.account.findFirstOrThrow();
  const assignment = await prisma.telephonyNumberAssignment.create({ data: { account_id: account.id, telephony_number_id: randomUUID(), provider_assistant_id: "fixture", status: "qualification" } });
  const capture = await prisma.callCaptureSession.create({ data: { account_id: account.id, provider_call_id: randomUUID(), assignment_id: assignment.id, snapshot_id: "fixture", snapshot_json: {}, call_session_id: randomUUID(), call_leg_id: randomUUID(), control_state: "START_PENDING", dtmf_decision: "affirmative", disclosure_completed_at: new Date() } });
  const proofId = randomUUID();
  const body = JSON.stringify({ data: { id: proofId, event_type: "call.gather.ended", occurred_at: new Date().toISOString(), payload: { call_control_id: capture.provider_call_id, call_session_id: capture.call_session_id, call_leg_id: capture.call_leg_id, status: "valid", digits: "1", client_state: Buffer.from(JSON.stringify({ captureId: capture.id, generation: capture.generation })).toString("base64") } } });
  const proof = await recordWebhookEvent({ account_id: account.id, provider: "telnyx", provider_call_id: capture.provider_call_id, provider_event_id: proofId, event_type: "call.gather.ended", raw_body: body, verifiedBytes: Buffer.from(body), signature_valid: true });
  if (!proof.ok) throw Error("fixture_proof_failed");
  await prisma.callCaptureSession.update({ where: { id: capture.id }, data: { dtmf_event_id: proofId } });
  await prisma.callConsentEvent.create({ data: { account_id: account.id, provider_call_id: capture.provider_call_id, event_key: randomUUID(), action: "grant", artifact: "transcript", disclosure_ref: "fixture", evidence_ref: "fixture", jurisdiction_basis: "fixture", source_channel: "call", actor_user_id: "user_operator_mock" } });
  return { capture, receipt: () => persistWithdrawalReceipt(capture, "user_operator_mock", { eventKey: randomUUID(), disclosureRef: "fixture", evidenceRef: "fixture", jurisdictionBasis: "fixture" }) };
}
function incoming(token: string, overrides = {}) {
  const raw = JSON.stringify({ eventId: randomUUID(), callId: randomUUID(), correlationToken: token, ...overrides });
  return { raw, headers: new Headers({ "x-synthetic-signature": syntheticMac(raw) }) };
}

async function mediaFixture() {
  const f = await fixture(), result = await beginGrokHandoff(f.capture);
  const token = transport.handoff.mock.calls.at(-1)![1] as string;
  const keys = generateKeyPairSync("ed25519"), streamUrl = "wss://synthetic.invalid/media?version=1";
  const timestamp = String(Math.floor(Date.now() / 1000));
  const headers = new Headers({ "telnyx-timestamp": timestamp, "telnyx-signature-ed25519": sign(null, Buffer.from(`${timestamp}|${streamUrl}`), keys.privateKey).toString("base64"), "x-telnyx-streaming-auth-token": token });
  const trusted = { streamUrl, publicKey: keys.publicKey.export({ format: "der", type: "spki" }).subarray(-32).toString("base64") };
  const frame = { event: "start", stream_id: randomUUID(), start: { call_control_id: f.capture.provider_call_id, call_session_id: f.capture.call_session_id, client_state: mediaClientState(f.capture.id, f.capture.generation), media_format: { encoding: "PCMU", sample_rate: 8000, channels: 1 } } };
  const input = { headers, connectedToken: token, rawStart: JSON.stringify(frame), trusted };
  const carrier = { bufferedAmount: 0, send: vi.fn(), close: vi.fn() }, realtime = { bufferedAmount: 0, send: vi.fn(), close: vi.fn() };
  const openRealtime = vi.fn().mockResolvedValue(realtime);
  return { ...f, id: result.sessionId, input, frame, carrier, realtime, openRealtime };
}

test("signed media binding consumes one capability under concurrency and keeps realtime separate from SIP", async () => {
  const f = await mediaFixture();
  const claims = await Promise.allSettled([claimGrokMedia(f.input.headers, f.input.rawStart, f.input.trusted), claimGrokMedia(f.input.headers, f.input.rawStart, f.input.trusted)]);
  expect(claims.filter(c => c.status === "fulfilled")).toHaveLength(1);
  const session = await prisma.grokCallSession.findUniqueOrThrow({ where: { id: f.id } });
  await bindGrokRealtime(f.id, session.worker_token!, "session_synthetic");
  expect((await prisma.grokCallSession.findUniqueOrThrow({ where: { id: f.id } })).xai_call_id).toBeNull();
  await expect(bindGrokRealtime(f.id, session.worker_token!, "other")).rejects.toThrow();
  await requestGrokStop(f.id, "test"); await dispatchGrokTermination(f.id);
  expect(transport.terminate).toHaveBeenCalledExactlyOnceWith("telnyx", f.capture.provider_call_id, expect.any(String));
});

test("one realtime session identity cannot bind two carrier calls", async () => {
  const first = await mediaFixture(), second = await mediaFixture();
  const a = await claimGrokMedia(first.input.headers, first.input.rawStart, first.input.trusted);
  const b = await claimGrokMedia(second.input.headers, second.input.rawStart, second.input.trusted);
  const results = await Promise.allSettled([bindGrokRealtime(first.id, a.session.worker_token!, "same_realtime_session"), bindGrokRealtime(second.id, b.session.worker_token!, "same_realtime_session")]);
  expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
  expect(await prisma.grokIncomingReceipt.count({ where: { event_id: "realtime:same_realtime_session" } })).toBe(1);
  expect(await prisma.grokCallCommand.count({ where: { kind: "join", status: "accepted" } })).toBe(1);
});

test.each(["signature", "url", "token", "call", "generation", "codec"])("media rejects %s mismatch before socket or claim", async kind => {
  const f = await mediaFixture();
  if (kind === "signature") f.input.headers.set("telnyx-signature-ed25519", Buffer.alloc(64).toString("base64"));
  if (kind === "url") f.input.trusted.streamUrl += "&changed=1";
  if (kind === "token") { f.input.headers.set("x-telnyx-streaming-auth-token", "f".repeat(64)); f.input.connectedToken = "f".repeat(64); }
  if (kind === "call") f.frame.start.call_control_id = "another-call";
  if (kind === "generation") f.frame.start.client_state = mediaClientState(f.capture.id, 99);
  if (kind === "codec") f.frame.start.media_format.sample_rate = 16000;
  f.input.rawStart = JSON.stringify(f.frame);
  await expect(startMediaBridge(f.input, f)).rejects.toThrow();
  expect(f.openRealtime).not.toHaveBeenCalled();
  expect((await prisma.grokCallSession.findUniqueOrThrow({ where: { id: f.id } })).worker_token).toBeNull();
});

test("withdrawn media capability cannot open xAI or reopen consent", async () => {
  const f = await mediaFixture(); await f.receipt();
  await expect(startMediaBridge(f.input, f)).rejects.toThrow(); expect(f.openRealtime).not.toHaveBeenCalled();
});

test.each(["denied", "expired-proof", "expired-lease"])("%s media authority permits zero xAI socket or audio", async reason => {
  if (reason === "expired-proof") vi.stubEnv("RESPONSEOS_WEBHOOK_FINGERPRINT_RETENTION_SECONDS", "3");
  const f = await mediaFixture();
  if (reason === "denied") await prisma.callConsentEvent.create({ data: { account_id: f.capture.account_id, provider_call_id: f.capture.provider_call_id, event_key: randomUUID(), action: "refuse", artifact: "transcript", disclosure_ref: "fixture", evidence_ref: "fixture", jurisdiction_basis: "fixture", source_channel: "call", actor_user_id: "user_operator_mock", occurred_at: new Date(Date.now() + 1000) } });
  if (reason === "expired-proof") await prisma.$executeRaw`SELECT pg_sleep(3.1)`;
  if (reason === "expired-lease") await prisma.grokCallSession.update({ where: { id: f.id }, data: { lease_expires_at: new Date(0) } });
  await expect(startMediaBridge(f.input, f)).rejects.toThrow();
  expect(f.openRealtime).not.toHaveBeenCalled(); expect(f.realtime.send).not.toHaveBeenCalled();
});

test.each(["stop", "barge-in"])("%s during queued playback fences every subsequent old-turn frame", async action => {
  const f = await mediaFixture(), bridge = await startMediaBridge(f.input, f);
  const mediaFrames = () => f.carrier.send.mock.calls.map(c => JSON.parse(c[0])).filter(frame => frame.event === "media");
  try {
    await bridge.xai(JSON.stringify({ type: "session.updated", session: { ...realtimeConfig.session, id: "session_fixture", model: "grok-voice-3.0" } }));
    await bridge.xai(JSON.stringify({ type: "response.created", response: { id: "old_turn" } }));
    await bridge.xai(JSON.stringify({ type: "response.output_audio.delta", response_id: "old_turn", delta: Buffer.alloc(8000, 17).toString("base64") }));
    await vi.waitFor(() => expect(mediaFrames().length).toBeGreaterThan(0));
    if (action === "stop") await bridge.stop("operator_end");
    else await bridge.xai(JSON.stringify({ type: "input_audio_buffer.speech_started" }));
    const sent = mediaFrames().length;
    expect(sent).toBeLessThan(50);
    expect(f.carrier.send.mock.calls.some(c => JSON.parse(c[0]).event === "clear")).toBe(true);
    await bridge.xai(JSON.stringify({ type: "response.output_audio.delta", response_id: "old_turn", delta: Buffer.alloc(160, 17).toString("base64") }));
    await new Promise(resolve => setTimeout(resolve, 80)); expect(mediaFrames()).toHaveLength(sent);
    if (action === "barge-in") {
      await bridge.xai(JSON.stringify({ type: "input_audio_buffer.speech_stopped" }));
      await bridge.xai(JSON.stringify({ type: "response.created", response: { id: "new_turn" } }));
      await bridge.xai(JSON.stringify({ type: "response.output_audio.delta", response_id: "new_turn", delta: Buffer.alloc(160, 34).toString("base64") }));
      await vi.waitFor(() => expect(mediaFrames()).toHaveLength(sent + 1));
      expect(Buffer.from(mediaFrames().at(-1).media.payload, "base64")).toEqual(Buffer.alloc(160, 34));
    }
  } finally { await bridge.stop("test_complete"); }
});

test("bridge pins model, negotiates PCMU, reorders bounded input and fences interrupted output", async () => {
  const f = await mediaFixture(), bridge = await startMediaBridge(f.input, f);
  try {
    expect(f.openRealtime).toHaveBeenCalledExactlyOnceWith(REALTIME_URL);
    expect(JSON.parse(f.realtime.send.mock.calls[0][0])).toEqual(realtimeConfig);
    await bridge.xai(JSON.stringify({ type: "session.updated", session: { ...realtimeConfig.session, id: "session_fixture", model: "grok-voice-3.0" } }));
    const audio = Buffer.alloc(160, 255).toString("base64");
    const packet = (chunk: number) => JSON.stringify({ event: "media", stream_id: f.frame.stream_id, sequence_number: String(chunk + 1), media: { track: "inbound", chunk: String(chunk), timestamp: String(chunk * 20), payload: audio } });
    await bridge.carrier(packet(2)); await bridge.carrier(packet(1));
    expect(f.realtime.send.mock.calls.filter(c => JSON.parse(c[0]).type === "input_audio_buffer.append")).toHaveLength(2);
    await bridge.xai(JSON.stringify({ type: "response.created", response: { id: "response_one" } }));
    await bridge.xai(JSON.stringify({ type: "response.output_audio.delta", response_id: "response_one", delta: audio }));
    await bridge.xai(JSON.stringify({ type: "input_audio_buffer.speech_started" }));
    await bridge.xai(JSON.stringify({ type: "response.output_audio.delta", response_id: "response_one", delta: audio }));
    await new Promise(resolve => setTimeout(resolve, 60));
    expect(f.carrier.send.mock.calls.filter(c => JSON.parse(c[0]).event === "media")).toHaveLength(0);
    expect(f.carrier.send.mock.calls.some(c => JSON.parse(c[0]).event === "clear")).toBe(true);
    await f.receipt(); await bridge.disconnected();
    await bridge.xai(JSON.stringify({ type: "response.created", response: { id: "late" } }));
    expect(bridge.disconnectionConfirmed).toBe(false);
    expect((await prisma.grokCallSession.findUniqueOrThrow({ where: { id: f.id } })).stopped_at).not.toBeNull();
  } finally { await bridge.stop("test_complete"); }
});

test.each(["model", "tools", "format", "event", "gap", "backpressure"])("bridge closes admission and requests exact hangup on %s fault", async kind => {
  const f = await mediaFixture(), bridge = await startMediaBridge(f.input, f);
  try {
    const session = JSON.parse(JSON.stringify({ ...realtimeConfig.session, id: "session_fixture", model: "grok-voice-3.0" }));
    if (kind === "model") session.model = "grok-voice-latest";
    if (kind === "tools") session.tools = [{ type: "web_search" }];
    if (kind === "format") session.audio.output.format.type = "audio/pcm";
    await bridge.xai(JSON.stringify({ type: "session.updated", session }));
    if (kind === "event") await bridge.xai(JSON.stringify({ type: "response.function_call_arguments.done" }));
    if (kind === "backpressure") f.realtime.bufferedAmount = 20000;
    if (kind === "gap" || kind === "backpressure") await bridge.carrier(JSON.stringify({ event: "media", stream_id: f.frame.stream_id, sequence_number: "3", media: { track: "inbound", chunk: kind === "gap" ? "99" : "1", timestamp: "20", payload: Buffer.alloc(160).toString("base64") } }));
    expect((await prisma.grokCallSession.findUniqueOrThrow({ where: { id: f.id } })).stopped_at).not.toBeNull();
    expect(transport.terminate).toHaveBeenCalledExactlyOnceWith("telnyx", f.capture.provider_call_id, expect.any(String));
    expect(f.realtime.close).toHaveBeenCalledTimes(1);
  } finally { await bridge.stop("test_complete"); }
});

test("withdrawal during socket open closes late connection without configuring it", async () => {
  const f = await mediaFixture();
  f.openRealtime.mockImplementation(async () => { await f.receipt(); return f.realtime; });
  await expect(startMediaBridge(f.input, f)).rejects.toThrow("media_open_failed");
  expect(f.realtime.send).not.toHaveBeenCalled(); expect(f.realtime.close).toHaveBeenCalledTimes(1);
});

test("network open failure consumes admission and concurrent shutdown never retries hangup", async () => {
  const f = await mediaFixture(); f.openRealtime.mockRejectedValue(Error("synthetic_network_loss"));
  await expect(startMediaBridge(f.input, f)).rejects.toThrow("media_open_failed");
  await expect(startMediaBridge(f.input, f)).rejects.toThrow("stream_binding_consumed_or_stopped");
  await Promise.all([dispatchGrokTermination(f.id), watchdogGrokSweep()]);
  expect(f.openRealtime).toHaveBeenCalledTimes(1); expect(transport.terminate).toHaveBeenCalledTimes(1);
});

test("saved withdrawal independently fences an active media bridge and clears both sockets", async () => {
  const f = await mediaFixture(), bridge = await startMediaBridge(f.input, f);
  try {
    await bridge.xai(JSON.stringify({ type: "session.updated", session: { ...realtimeConfig.session, id: "session_fixture", model: "grok-voice-3.0" } }));
    await f.receipt();
    await vi.waitFor(() => expect(f.realtime.close).toHaveBeenCalledTimes(1), { timeout: 4000 });
    await bridge.stop("test_complete");
    expect(transport.terminate).toHaveBeenCalledExactlyOnceWith("telnyx", f.capture.provider_call_id, expect.any(String));
    expect(f.carrier.close).toHaveBeenCalledTimes(1);
    expect((await prisma.grokCallSession.findUniqueOrThrow({ where: { id: f.id } })).stopped_at).not.toBeNull();
  } finally { await bridge.stop("test_complete"); }
});

test("media output is paced as PCMU and termination evidence remains unconfirmed", async () => {
  const f = await mediaFixture(), bridge = await startMediaBridge(f.input, f);
  try {
    await bridge.xai(JSON.stringify({ type: "session.updated", session: { ...realtimeConfig.session, id: "session_fixture", model: "grok-voice-3.0" } }));
    await bridge.xai(JSON.stringify({ type: "response.created", response: { id: "response_one" } }));
    await bridge.xai(JSON.stringify({ type: "response.output_audio.delta", response_id: "response_one", delta: Buffer.alloc(320, 255).toString("base64") }));
    await vi.waitFor(() => expect(f.carrier.send.mock.calls.filter(c => JSON.parse(c[0]).event === "media")).toHaveLength(2));
    for (const [raw] of f.carrier.send.mock.calls) { const frame = JSON.parse(raw); if (frame.event === "media") expect(Buffer.from(frame.media.payload, "base64")).toHaveLength(160); }
    await Promise.all([bridge.disconnected(), bridge.stop("concurrent_operator")]);
    expect(transport.terminate).toHaveBeenCalledTimes(1); expect(bridge.disconnectionConfirmed).toBe(false);
  } finally { await bridge.stop("test_complete"); }
});

test("audio discarded during negotiation is never replayed and advances the input cursor", async () => {
  const f = await mediaFixture(), bridge = await startMediaBridge(f.input, f);
  try {
    const packet = (chunk: number) => JSON.stringify({ event: "media", stream_id: f.frame.stream_id, sequence_number: String(chunk + 1), media: { track: "inbound", chunk: String(chunk), timestamp: String(chunk * 20), payload: Buffer.alloc(160, 255).toString("base64") } });
    await bridge.carrier(packet(1)); await bridge.carrier(packet(2));
    expect(f.realtime.send.mock.calls.filter(c => JSON.parse(c[0]).type === "input_audio_buffer.append")).toHaveLength(0);
    await bridge.xai(JSON.stringify({ type: "session.updated", session: { ...realtimeConfig.session, id: "session_fixture", model: "grok-voice-3.0" } }));
    await bridge.carrier(packet(3));
    expect(f.realtime.send.mock.calls.filter(c => JSON.parse(c[0]).type === "input_audio_buffer.append")).toHaveLength(1);
    expect(f.realtime.close).not.toHaveBeenCalled();
  } finally { await bridge.stop("test_complete"); }
});
async function bound() {
  const f = await fixture(); const started = await beginGrokHandoff(f.capture);
  const message = incoming(transport.handoff.mock.calls.at(-1)![1]);
  await acceptGrokIncoming(message.raw, message.headers);
  return { ...f, id: started.sessionId, message };
}
function afterCommit(effect: () => Promise<unknown>) {
  const original = db!.$transaction.bind(db!);
  const spy = vi.spyOn(db!, "$transaction").mockImplementation((async (...args: unknown[]) => {
    const result = await Reflect.apply(original, db!, args);
    if (result && typeof result === "object" && "command" in result && "session" in result) { spy.mockRestore(); await effect(); }
    return result;
  }) as NonNullable<typeof db>["$transaction"]);
}

test("atomic concurrent grants consume exactly one durable handoff with actor audit", async () => {
  const f = await fixture();
  const results = await Promise.allSettled([beginGrokHandoff(f.capture), beginGrokHandoff(f.capture)]);
  expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
  expect(transport.handoff).toHaveBeenCalledTimes(1);
  expect(await prisma.grokCallSession.count()).toBe(1);
  expect(await prisma.grokCallCommand.count({ where: { kind: "handoff" } })).toBe(1);
  expect(await prisma.auditLog.count({ where: { action: "grok_handoff_consumed" } })).toBe(1);
});

test.each(["account_id", "generation", "provider_call_id", "call_leg_id", "call_session_id", "assignment_id"] as const)("rejects stale or cross-call %s before claim", async key => {
  const f = await fixture();
  await expect(beginGrokHandoff({ ...f.capture, [key]: key === "generation" ? 2 : "other" })).rejects.toThrow();
  expect(await prisma.grokCallSession.count()).toBe(0); expect(transport.handoff).not.toHaveBeenCalled();
});

test("missing disclosure or consent cannot authorize handoff", async () => {
  const f = await fixture();
  await prisma.callCaptureSession.update({ where: { id: f.capture.id }, data: { disclosure_completed_at: null } });
  await expect(beginGrokHandoff(f.capture)).rejects.toThrow("disclosure_completion_required");
  expect(transport.handoff).not.toHaveBeenCalled();
});

test("withdrawal committed after claim vetoes send without releasing claim", async () => {
  const f = await fixture(); afterCommit(f.receipt);
  await expect(beginGrokHandoff(f.capture)).rejects.toThrow("grok_presend_veto");
  await expect(beginGrokHandoff(f.capture)).rejects.toThrow("grok_handoff_consumed");
  expect(transport.handoff).not.toHaveBeenCalled();
  expect((await prisma.grokCallSession.findFirstOrThrow()).stopped_at).not.toBeNull();
});

test("same operator ID with a changed privileged role vetoes postcommit handoff", async () => {
  const f = await fixture(), actor = await operatorService.requireReviewOperator();
  afterCommit(async () => { vi.spyOn(operatorService, "requireReviewOperator").mockResolvedValue({ ...actor, user: { ...actor.user, role: "aj_admin" } }); });
  await expect(beginGrokHandoff(f.capture)).rejects.toThrow("grok_presend_veto");
  expect(transport.handoff).not.toHaveBeenCalled();
});

test("retained Grok authority trigger pins its search path", async () => {
  const rows = await prisma.$queryRaw<{ proconfig: string[] }[]>`SELECT proconfig FROM pg_proc WHERE oid='public.grok_authority_guard()'::regprocedure`;
  expect(rows[0].proconfig).toContain("search_path=pg_catalog");
});

test.each(["accepted", "uncertain"])("operator fallback stays distinct after %s automatic termination and never resends either claim", async status => {
  const f = await bound(); await f.receipt();
  transport.terminate.mockResolvedValue(status);
  await requestGrokStop(f.id, "withdrawal_or_control_loss"); await dispatchGrokTermination(f.id);
  transport.operatorEnd.mockResolvedValue({ ok: false, status: 0, errorCode: "telnyx_response_uncertain", providerDate: null });
  const invoke = () => endPost(new Request("http://localhost", { method: "POST", body: JSON.stringify({ expectedAccountId: f.capture.account_id, expectedProviderCallId: f.capture.provider_call_id, generation: f.capture.generation }) }), { params: Promise.resolve({ id: f.capture.id }) });
  const responses = await Promise.all([invoke(), invoke()]);
  for (const response of responses) { expect(response.status).toBe(202); expect((await response.json()).data).toMatchObject({ commandStatus: "uncertain", disconnection: { confirmed: false } }); }
  await invoke(); await watchdogGrokSweep();
  expect(transport.operatorEnd).toHaveBeenCalledTimes(1); expect(transport.terminate).toHaveBeenCalledTimes(2);
  expect((await prisma.grokCallSession.findUniqueOrThrow({ where: { id: f.id } })).stopped_at).not.toBeNull();
  expect(await prisma.callWithdrawalReceipt.count()).toBe(1);
});

test("watchdog isolates a session transaction failure and does not scan settled history", async () => {
  const first = await bound(), second = await bound();
  await requestGrokStop(first.id, "test_control_loss"); await requestGrokStop(second.id, "test_control_loss");
  vi.spyOn(db!, "$transaction").mockRejectedValueOnce(Error("synthetic_database_fault"));
  expect(await watchdogGrokSweep()).toMatchObject({ inspected: 2, failed: 1 });
  expect(transport.terminate).toHaveBeenCalledTimes(2);
  expect(await watchdogGrokSweep()).toMatchObject({ inspected: 1, failed: 0 });
  expect(transport.terminate).toHaveBeenCalledTimes(4);
  expect(await watchdogGrokSweep()).toEqual({ inspected: 0, failed: 0 });
});

test.each(["lifecycle", "unverifiable-hangup", "expired-active-proof"])("refused operator %s leaves automatic termination available without an operator reservation", async reason => {
  if (reason === "expired-active-proof") vi.stubEnv("RESPONSEOS_WEBHOOK_FINGERPRINT_RETENTION_SECONDS", "3");
  const f = await mediaFixture();
  if (reason === "lifecycle") await prisma.callCaptureSession.update({ where: { id: f.capture.id }, data: { control_state: "EVIDENCE_FROZEN" } });
  if (reason === "unverifiable-hangup") await prisma.webhookEvent.create({ data: { account_id: f.capture.account_id, provider: "telnyx", provider_call_id: f.capture.provider_call_id, provider_event_id: randomUUID(), event_type: "call.hangup", raw_body: "{}", dedupe_hash: randomUUID(), signature_valid: false } });
  if (reason === "expired-active-proof") await prisma.$executeRaw`SELECT pg_sleep(3.1)`;
  await expect(grokService.operatorEndGrok(f.capture)).rejects.toThrow("end_call_ineligible");
  expect(await prisma.telnyxCallCommand.count({ where: { capture_session_id: f.capture.id, command_type: "hangup" } })).toBe(0);
  await watchdogGrokSweep(); await watchdogGrokSweep();
  expect(transport.operatorEnd).not.toHaveBeenCalled();
  expect(transport.terminate).toHaveBeenCalledExactlyOnceWith("telnyx", f.capture.provider_call_id, expect.any(String));
});

test("capture lock timeout before operator reservation cannot suppress the automatic safety claim", async () => {
  const f = await mediaFixture();
  let release!: () => void, entered!: () => void;
  const held = new Promise<void>(resolve => { entered = resolve; }), gate = new Promise<void>(resolve => { release = resolve; });
  const holder = prisma.$transaction(async tx => { await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"capture:" + f.capture.account_id + ":" + f.capture.provider_call_id}))`; entered(); await gate; }, { timeout: 10000 });
  try {
    await Promise.race([held, holder]);
    await expect(grokService.operatorEndGrok(f.capture)).rejects.toThrow();
    expect(await prisma.telnyxCallCommand.count({ where: { capture_session_id: f.capture.id, command_type: "hangup" } })).toBe(0);
    await watchdogGrokSweep(); await watchdogGrokSweep();
    expect(transport.operatorEnd).not.toHaveBeenCalled(); expect(transport.terminate).toHaveBeenCalledTimes(1);
  } finally { release(); await holder; }
});

test("committed operator reservation fences queued automatic hangup during concurrent dispatch without resending", async () => {
  const f = await mediaFixture(); await requestGrokStop(f.id, "control_loss");
  let entered!: () => void, release!: () => void;
  const sent = new Promise<void>(resolve => { entered = resolve; }), gate = new Promise<void>(resolve => { release = resolve; });
  transport.operatorEnd.mockImplementation(async () => { entered(); await gate; return { ok: false, status: 0, errorCode: "telnyx_response_uncertain", providerDate: null }; });
  const operator = grokService.operatorEndGrok(f.capture);
  try {
    await sent;
    await Promise.all([dispatchGrokTermination(f.id), watchdogGrokSweep(), grokService.operatorEndGrok(f.capture)]);
    expect(transport.terminate).not.toHaveBeenCalled();
    expect(transport.operatorEnd).toHaveBeenCalledTimes(1);
    expect((await prisma.grokCallCommand.findFirstOrThrow({ where: { session_id: f.id, kind: "telnyx_hangup" } })).status).toBe("disabled");
  } finally { release(); await operator; }
  await watchdogGrokSweep(); await grokService.operatorEndGrok(f.capture);
  expect(transport.operatorEnd).toHaveBeenCalledTimes(1); expect(transport.terminate).not.toHaveBeenCalled();
});

test("authenticated terminal proof before any operator reservation cannot create a second carrier send", async () => {
  const f = await mediaFixture(), eventId = randomUUID();
  const body = JSON.stringify({ data: { id: eventId, event_type: "call.hangup", occurred_at: new Date().toISOString(), payload: { call_control_id: f.capture.provider_call_id, call_session_id: f.capture.call_session_id, call_leg_id: f.capture.call_leg_id, client_state: mediaClientState(f.capture.id, f.capture.generation) } } });
  await recordWebhookEvent({ account_id: f.capture.account_id, provider: "telnyx", provider_call_id: f.capture.provider_call_id, provider_event_id: eventId, event_type: "call.hangup", raw_body: body, verifiedBytes: Buffer.from(body), signature_valid: true });
  expect((await grokService.operatorEndGrok(f.capture)).disconnection.confirmed).toBe(true);
  await watchdogGrokSweep(); await dispatchGrokTermination(f.id);
  expect(transport.operatorEnd).not.toHaveBeenCalled(); expect(transport.terminate).not.toHaveBeenCalled();
  expect(await prisma.telnyxCallCommand.count({ where: { capture_session_id: f.capture.id, command_type: "hangup" } })).toBe(0);
});

test("operator reservation rollback leaves no suppression authority", async () => {
  const f = await mediaFixture();
  await prisma.$executeRawUnsafe(`CREATE FUNCTION grok_test_operator_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='grok_operator_end' THEN RAISE EXCEPTION 'synthetic_operator_audit_failure'; END IF; RETURN NEW; END $$`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER grok_test_operator_audit BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION grok_test_operator_audit()`);
  try { await expect(grokService.operatorEndGrok(f.capture)).rejects.toThrow(); }
  finally { await prisma.$executeRawUnsafe(`DROP TRIGGER grok_test_operator_audit ON "AuditLog"`); await prisma.$executeRawUnsafe(`DROP FUNCTION grok_test_operator_audit()`); }
  expect(await prisma.telnyxCallCommand.count({ where: { capture_session_id: f.capture.id, command_type: "hangup" } })).toBe(0);
  await watchdogGrokSweep(); await watchdogGrokSweep();
  expect(transport.operatorEnd).not.toHaveBeenCalled(); expect(transport.terminate).toHaveBeenCalledTimes(1);
});

test("Grok operator route requires authenticated exact-call evidence to report disconnection", async () => {
  const f = await bound(); await f.receipt();
  const invoke = () => endPost(new Request("http://localhost", { method: "POST", body: JSON.stringify({ expectedAccountId: f.capture.account_id, expectedProviderCallId: f.capture.provider_call_id, generation: f.capture.generation }) }), { params: Promise.resolve({ id: f.capture.id }) });
  const accepted = await invoke(); expect(accepted.status).toBe(202);
  expect((await accepted.json()).data).toMatchObject({ commandStatus: "succeeded", disconnection: { confirmed: false } });
  const eventId = randomUUID(), body = JSON.stringify({ data: { id: eventId, event_type: "call.hangup", occurred_at: new Date().toISOString(), payload: { call_control_id: f.capture.provider_call_id, call_session_id: f.capture.call_session_id, call_leg_id: f.capture.call_leg_id, client_state: mediaClientState(f.capture.id, f.capture.generation) } } });
  await recordWebhookEvent({ account_id: f.capture.account_id, provider: "telnyx", provider_call_id: f.capture.provider_call_id, provider_event_id: eventId, event_type: "call.hangup", raw_body: body, verifiedBytes: Buffer.from(body), signature_valid: true });
  const confirmed = await invoke(); expect(confirmed.status).toBe(200);
  expect((await confirmed.json()).data.disconnection).toMatchObject({ confirmed: true, eventId });
  expect(transport.operatorEnd).toHaveBeenCalledTimes(1); expect(await prisma.callWithdrawalReceipt.count()).toBe(1);
});

test("lost claim commit acknowledgement permits no later resend", async () => {
  const f = await fixture(); afterCommit(async () => { throw Error("lost_commit_ack"); });
  await expect(beginGrokHandoff(f.capture)).rejects.toThrow("lost_commit_ack");
  await expect(beginGrokHandoff(f.capture)).rejects.toThrow("grok_handoff_consumed");
  expect(transport.handoff).not.toHaveBeenCalled();
});

test.each(["uncertain", "failed", "disabled"])("%s result consumes handoff and requests termination", async result => {
  const f = await fixture(); transport.handoff.mockResolvedValue(result);
  await beginGrokHandoff(f.capture);
  await expect(beginGrokHandoff(f.capture)).rejects.toThrow("grok_handoff_consumed");
  expect(transport.handoff).toHaveBeenCalledTimes(1);
  expect((await prisma.grokCallSession.findFirstOrThrow()).stopped_at).not.toBeNull();
});

test("unverified incoming delivery cannot bind or create evidence", async () => {
  const f = await fixture(); await beginGrokHandoff(f.capture);
  const message = incoming(transport.handoff.mock.calls[0][1]);
  await expect(acceptGrokIncoming(message.raw, new Headers())).rejects.toThrow("unverified_fixture");
  expect(await prisma.grokIncomingReceipt.count()).toBe(0);
  expect((await prisma.grokCallSession.findFirstOrThrow()).xai_call_id).toBeNull();
});

test("authenticated fixture must match server correlation; caller account claims ignored", async () => {
  const f = await fixture(); await beginGrokHandoff(f.capture);
  const wrong = incoming("a".repeat(64), { account_id: f.capture.account_id });
  await expect(acceptGrokIncoming(wrong.raw, wrong.headers)).rejects.toThrow("grok_correlation_unknown");
  const right = incoming(transport.handoff.mock.calls[0][1], { account_id: "attacker" });
  await acceptGrokIncoming(right.raw, right.headers);
  expect((await prisma.grokCallSession.findFirstOrThrow()).account_id).toBe(f.capture.account_id);
});

test("duplicates are idempotent, conflicting replay and xAI retargeting are denied", async () => {
  const f = await bound();
  await acceptGrokIncoming(f.message.raw, f.message.headers);
  expect(await prisma.grokIncomingReceipt.count()).toBe(1);
  const changed = incoming(transport.handoff.mock.calls[0][1], { ...JSON.parse(f.message.raw), extra: "conflict" });
  await expect(acceptGrokIncoming(changed.raw, changed.headers)).rejects.toThrow("grok_replay_conflict");
  const retarget = incoming(transport.handoff.mock.calls[0][1]);
  await expect(acceptGrokIncoming(retarget.raw, retarget.headers)).rejects.toThrow("grok_call_retarget_denied");
});

test("late binding after withdrawal is retained solely for exact termination", async () => {
  const f = await fixture(); const started = await beginGrokHandoff(f.capture); await f.receipt();
  const message = incoming(transport.handoff.mock.calls[0][1]);
  expect(await acceptGrokIncoming(message.raw, message.headers)).toMatchObject({ stopped: true, disconnectionConfirmed: false });
  await expect(claimGrokWorker(started.sessionId)).rejects.toThrow("grok_worker_not_eligible");
  await dispatchGrokTermination(started.sessionId);
  expect(transport.terminate.mock.calls.map(c => [c[0], c[1]]).sort()).toEqual([["telnyx", f.capture.provider_call_id], ["xai", JSON.parse(message.raw).callId]].sort());
});

test("concurrent watchdog and operator dispatch consume each termination once", async () => {
  const f = await bound(); await requestGrokStop(f.id, "withdrawal");
  await Promise.all([dispatchGrokTermination(f.id), dispatchGrokTermination(f.id), watchdogGrokSweep()]);
  expect(transport.terminate).toHaveBeenCalledTimes(2);
  const response = await statusGet(new Request("http://localhost"), { params: Promise.resolve({ id: f.capture.id }) });
  expect((await response.json()).data.disconnectionConfirmed).toBe(false);
});

test("stalled carrier hangup does not block the independent xAI termination attempt", async () => {
  const f = await bound(); await requestGrokStop(f.id, "control_lost");
  let release!: () => void, xaiSent!: () => void;
  const stalled = new Promise<void>(r => { release = r; }), ready = new Promise<void>(r => { xaiSent = r; });
  transport.terminate.mockImplementation(async (provider: string) => { if (provider === "telnyx") await stalled; else xaiSent(); return "accepted"; });
  const dispatch = dispatchGrokTermination(f.id);
  try { await ready; await vi.waitFor(() => expect(transport.terminate).toHaveBeenCalledTimes(2)); }
  finally { release(); await dispatch; }
});

test("audit failure rolls back durable handoff authority without sending", async () => {
  const f = await fixture();
  await prisma.$executeRawUnsafe(`CREATE FUNCTION grok_test_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='grok_handoff_consumed' THEN RAISE EXCEPTION 'test audit failure'; END IF; RETURN NEW; END $$`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER grok_test_audit_failure BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION grok_test_audit_failure()`);
  try { await expect(beginGrokHandoff(f.capture)).rejects.toThrow(); }
  finally { await prisma.$executeRawUnsafe(`DROP TRIGGER grok_test_audit_failure ON "AuditLog"`); await prisma.$executeRawUnsafe(`DROP FUNCTION grok_test_audit_failure()`); }
  expect(await prisma.grokCallSession.count()).toBe(0); expect(transport.handoff).not.toHaveBeenCalled();
});

test("result persistence failure after provider acceptance never permits a second handoff", async () => {
  const f = await fixture();
  await prisma.$executeRawUnsafe(`CREATE FUNCTION grok_test_result_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.kind='handoff' AND NEW.result_at IS NOT NULL THEN RAISE EXCEPTION 'test result failure'; END IF; RETURN NEW; END $$`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER grok_test_result_failure BEFORE UPDATE ON "GrokCallCommand" FOR EACH ROW EXECUTE FUNCTION grok_test_result_failure()`);
  try { await expect(beginGrokHandoff(f.capture)).rejects.toThrow(); }
  finally { await prisma.$executeRawUnsafe(`DROP TRIGGER grok_test_result_failure ON "GrokCallCommand"`); await prisma.$executeRawUnsafe(`DROP FUNCTION grok_test_result_failure()`); }
  await expect(beginGrokHandoff(f.capture)).rejects.toThrow("grok_handoff_consumed");
  expect(transport.handoff).toHaveBeenCalledTimes(1);
});

test("expired worker cannot renew, acquire replacement ownership or reopen stopped session", async () => {
  const f = await bound(), claimed = await claimGrokWorker(f.id);
  await prisma.grokCallSession.update({ where: { id: f.id }, data: { lease_expires_at: new Date(0) } });
  expect(await heartbeatGrok(f.id, claimed.session.worker_token!)).toBe(false);
  await expect(claimGrokWorker(f.id)).rejects.toThrow("grok_worker_not_eligible");
  await expect(prisma.grokCallSession.update({ where: { id: f.id }, data: { stopped_at: null } })).rejects.toThrow();
  await expect(prisma.grokCallSession.update({ where: { id: f.id }, data: { xai_call_id: randomUUID() } })).rejects.toThrow();
});

test("stalled handoff holds no database lock against independent withdrawal/watchdog", async () => {
  const f = await fixture(); let release!: () => void; let entered!: () => void;
  const ready = new Promise<void>(r => { entered = r; }); const stalled = new Promise<void>(r => { release = r; });
  transport.handoff.mockImplementation(async () => { entered(); await stalled; return "accepted"; });
  const pending = beginGrokHandoff(f.capture); await ready;
  try { await f.receipt(); await watchdogGrokSweep(); expect(transport.terminate).toHaveBeenCalledTimes(1); }
  finally { release(); }
  await pending;
  expect((await prisma.grokCallSession.findFirstOrThrow()).stopped_at).not.toBeNull();
});

test("actual consent route selects Grok without issuing Telnyx assistant start", async () => {
  const f = await fixture();
  await prisma.callCaptureSession.update({ where: { id: f.capture.id }, data: { control_state: "CONSENT_PENDING_OPERATOR" } });
  vi.stubEnv("RESPONSEOS_VOICE_ENGINE", "grok-voice-3.0");
  const response = await consentPost(new Request("http://localhost", { method: "POST", body: JSON.stringify({ action: "grant", eventKey: randomUUID(), disclosureRef: "fixture", evidenceRef: "fixture", jurisdictionBasis: "fixture" }) }), { params: Promise.resolve({ id: f.capture.id }) });
  expect(response.status).toBe(200); expect(transport.handoff).toHaveBeenCalledTimes(1);
  expect(await prisma.telnyxCallCommand.count({ where: { command_type: "ai_assistant_start" } })).toBe(0);
});

test("operator End call rejects stale generation; client and anonymous cannot inspect or terminate", async () => {
  const f = await bound();
  const request = (generation: number) => new Request("http://localhost", { method: "POST", body: JSON.stringify({ expectedAccountId: f.capture.account_id, expectedProviderCallId: f.capture.provider_call_id, generation }) });
  const params = { params: Promise.resolve({ id: f.capture.id }) };
  expect((await endPost(request(2), params)).status).toBe(409);
  setDevSession("client_admin@org_mock_1"); expect((await endPost(request(1), params)).status).toBe(403); expect((await statusGet(new Request("http://localhost"), params)).status).toBe(403);
  vi.stubEnv("RESPONSEOS_REQUIRE_AUTH", "true"); vi.stubEnv("RESPONSEOS_DEV_SESSION", ""); expect((await endPost(request(1), params)).status).toBe(403);
  vi.stubEnv("RESPONSEOS_REQUIRE_AUTH", "false"); setDevSession("operator"); expect((await endPost(request(1), params)).status).toBe(202);
  expect(transport.operatorEnd).toHaveBeenCalledTimes(1);
});

test("ingestion route rejects oversized body and unauthenticated fixture", async () => {
  expect((await incomingPost(new Request("http://localhost", { method: "POST", headers: { "content-type": "application/json" }, body: "x".repeat(65537) }))).status).toBe(413);
  expect((await incomingPost(new Request("http://localhost", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }))).status).toBe(503);
});

test("separate real watchdog process consumes durable hangups after heartbeat process death", async () => {
  const f = await bound(), claim = await claimGrokWorker(f.id);
  const tsx = path.resolve("node_modules/tsx/dist/cli.mjs");
  const worker = spawn(process.execPath, [tsx, "tests/integration/fixtures/grok-heartbeat-worker.ts", f.id, claim.session.worker_token!], { stdio: ["ignore", "pipe", "pipe"], env: process.env });
  try {
    await once(worker.stdout, "data");
    const exited = once(worker, "exit"); worker.kill(); await exited;
    await prisma.grokCallSession.update({ where: { id: f.id }, data: { lease_expires_at: new Date(0) } });
    const watcher = spawnSync(process.execPath, [tsx, "scripts/grok-watchdog.ts"], { env: { ...process.env, RESPONSEOS_GROK_WATCHDOG_ENABLED: "true" }, encoding: "utf8", timeout: 15000 });
    expect(watcher.status, watcher.stderr).toBe(0);
    expect((await prisma.grokCallSession.findUniqueOrThrow({ where: { id: f.id } })).stopped_at).not.toBeNull();
    const commands = await prisma.grokCallCommand.findMany({ where: { session_id: f.id, kind: { endsWith: "hangup" } } });
    expect(commands).toHaveLength(2); expect(commands.every(c => c.status === "disabled" && c.consumed_at)).toBe(true);
    expect(transport.terminate).not.toHaveBeenCalled();
  } finally { if (worker.exitCode === null && worker.signalCode === null) worker.kill(); }
});

test("watchdog loop survives repeated database failures and emits intervention alerts", async () => {
  const watcher = spawn(process.execPath, [path.resolve("node_modules/tsx/dist/cli.mjs"), "scripts/grok-watchdog.ts", "--loop"], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, RESPONSEOS_GROK_WATCHDOG_ENABLED: "true", DATABASE_URL: "postgresql://missing_watchdog_role@127.0.0.1:5432/responseos_test" },
  });
  let alerts = ""; watcher.stderr.on("data", bytes => { alerts += bytes.toString(); });
  try {
    await vi.waitFor(() => expect(alerts.match(/Grok watchdog sweep incomplete/g)?.length ?? 0).toBeGreaterThanOrEqual(2), { timeout: 12000 });
    expect(watcher.exitCode).toBeNull(); expect(alerts).toContain("Consumed commands will not be retried");
  } finally { watcher.kill("SIGTERM"); await once(watcher, "exit"); }
});
