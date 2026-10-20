import "@/lib/serverOnlyGuard";
import { createServer as createHttpsServer, type ServerOptions } from "node:https";
import { createServer as createHttpServer } from "node:http";
import { readFileSync } from "node:fs";
import { z } from "zod";
import WebSocket, { WebSocketServer } from "ws";
import { authenticateStream, startFrame } from "./mediaContract";
import { startMediaBridge, startupMediaCursor, type StartupCursor } from "./mediaBridge";
import { openRealtimeSocket, socketPort, type TransportConfig } from "./networkTransport";
import { assertGrokQualified } from "./provider";

type Ingress = { ingress?: "direct-tls"; tls: Pick<ServerOptions, "key" | "cert"> } | { ingress: "managed-edge-http"; tls?: never };
export function parseMediaListenerConfig(raw: unknown, envPort: string | undefined) {
  const common = { mode: z.literal("production"), streamUrl: z.string().url(), publicKey: z.string() };
  const config = z.union([
    z.object({ ...common, ingress: z.literal("direct-tls").default("direct-tls"), certificatePath: z.string().min(1), privateKeyPath: z.string().min(1), port: z.number().int().min(1024).max(65535) }).strict(),
    z.object({ ...common, ingress: z.literal("managed-edge-http") }).strict(),
  ]).parse(raw);
  if (config.ingress === "direct-tls") return config;
  const port = z.string().regex(/^[1-9]\d{0,4}$/).transform(Number).pipe(z.number().int().min(1024).max(65535)).parse(envPort);
  return { ...config, port };
}

export function createGrokMediaServer(config: { streamUrl: string; publicKey: string; realtime: TransportConfig; fault?: () => void } & Ingress) {
  const origin = new URL(config.streamUrl);
  if (origin.protocol !== "wss:" || origin.username || origin.password || origin.hash) throw Error("media_listener_url_invalid");
  if (config.realtime.mode === "production") {
    assertGrokQualified();
    const approved = JSON.parse(readFileSync(process.env.RESPONSEOS_GROK_MEDIA_CONFIG!, "utf8"));
    if (approved.streamUrl !== config.streamUrl || approved.publicKey !== config.publicKey || (approved.ingress ?? "direct-tls") !== (config.ingress ?? "direct-tls")) throw Error("qualification_listener_mismatch");
  }
  else if (config.realtime.mode !== "local-synthetic" || origin.hostname !== "127.0.0.1") throw Error("listener_mode_required");
  const ingress = config.ingress ?? "direct-tls";
  if (ingress !== "direct-tls" && ingress !== "managed-edge-http") throw Error("listener_ingress_invalid");
  if (ingress === "direct-tls" && (!config.tls?.key || !config.tls?.cert)) throw Error("listener_tls_required");
  if (ingress === "managed-edge-http" && (config.tls !== undefined || origin.href !== config.streamUrl)) throw Error("listener_edge_config_invalid");
  const server = ingress === "direct-tls"
    ? createHttpsServer({ ...config.tls, minVersion: "TLSv1.2", maxHeaderSize: 8192 })
    : createHttpServer({ maxHeaderSize: 8192 });
  server.on("request", (_request, response) => { response.writeHead(404); response.end(); });
  server.requestTimeout = 5000; server.headersTimeout = 5000;
  const limits = { noServer: true, perMessageDeflate: false, maxPayload: 16384, maxFragments: 64, maxBufferedChunks: 64, closeTimeout: 1000 };
  const wss = new WebSocketServer(limits);
  const shutdowns = new Set<() => void>();
  const pending = new Set<Promise<unknown>>();
  function track(task: Promise<unknown>) { pending.add(task); void task.finally(() => pending.delete(task)).catch(() => {}); }
  server.on("upgrade", (request, socket, head) => {
    socket.on("error", () => {});
    try {
      if (config.realtime.mode === "production") assertGrokQualified();
      if (request.url !== origin.pathname + origin.search || request.headers.host !== origin.host || wss.clients.size >= 4) throw Error("stream_destination_invalid");
      if (request.rawHeaders.filter((v, i) => i % 2 === 0 && v.toLowerCase() === "host").length !== 1) throw Error("stream_host_invalid");
      const headers = new Headers();
      for (const name of ["telnyx-timestamp", "telnyx-signature-ed25519", "x-telnyx-streaming-auth-token"]) {
        if (request.rawHeaders.filter((v, i) => i % 2 === 0 && v.toLowerCase() === name).length !== 1) throw Error("stream_header_invalid");
        const value = request.headers[name]; if (typeof value !== "string") throw Error("stream_header_invalid"); headers.set(name, value);
      }
      authenticateStream(headers, config.streamUrl, config.publicKey);
      wss.handleUpgrade(request, socket, head, carrier => connect(carrier, headers));
    } catch { socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n"); }
  });
  function connect(carrier: WebSocket, headers: Headers) {
    let closed = false, pumping = false, bytes = 0, connectedToken: unknown;
    let phase: "connected" | "start" | "starting" | "active" = "connected";
    let startup: StartupCursor | undefined, streamId: string | undefined;
    let bridge: Awaited<ReturnType<typeof startMediaBridge>> | undefined, realtime: WebSocket | undefined;
    let carrierPong = performance.now(), realtimePong = performance.now();
    const queue: { source: "carrier" | "xai"; raw: string }[] = [];
    const onFault = () => config.fault?.();
    function fail() {
      if (closed) return;
      closed = true; queue.length = 0; bytes = 0; clearTimeout(startDeadline); clearInterval(ping);
      carrier.terminate(); realtime?.terminate(); shutdowns.delete(fail);
      if (bridge) track(bridge.disconnected().catch(onFault));
    }
    const startDeadline = setTimeout(fail, 5000);
    const ping = setInterval(() => {
      if (performance.now() - carrierPong > 3000 || (realtime && performance.now() - realtimePong > 3000)) { fail(); return; }
      if (carrier.readyState === WebSocket.OPEN) carrier.ping();
      if (realtime?.readyState === WebSocket.OPEN) realtime.ping();
    }, 1000);
    shutdowns.add(fail);
    carrier.on("pong", () => { carrierPong = performance.now(); });
    carrier.on("error", fail); carrier.on("close", fail);
    carrier.on("message", (data, binary) => { if (binary) fail(); else enqueue("carrier", data.toString()); });
    function enqueue(source: "carrier" | "xai", raw: string) {
      if (closed) return;
      const size = Buffer.byteLength(raw);
      if (size > 16384) { fail(); return; }
      if (source === "carrier" && (phase === "starting" || (phase === "active" && !bridge!.acceptingAudio))) {
        try {
          if (JSON.parse(raw).event === "media") {
            const cursor = startupMediaCursor(raw, streamId!);
            if (bridge) bridge.discardStartup(cursor);
            else startup = { chunk: Math.max(startup?.chunk ?? 0, cursor.chunk), timestamp: Math.max(startup?.timestamp ?? -1, cursor.timestamp), sequence: Math.max(startup?.sequence ?? -1, cursor.sequence) };
            return;
          }
        } catch { fail(); return; }
      }
      if (bytes + size > 32768 || queue.length >= 64) { fail(); return; }
      bytes += size; queue.push({ source, raw }); track(pump());
    }
    async function pump() {
      if (pumping || closed) return;
      pumping = true;
      try {
        while (!closed && queue.length) {
          const next = queue.shift()!; bytes -= Buffer.byteLength(next.raw);
          if (phase === "connected") {
            const frame = JSON.parse(next.raw);
            if (next.source !== "carrier" || frame.event !== "connected" || frame.version !== "1.0.0") throw Error("stream_connected_required");
            connectedToken = frame["x-telnyx-streaming-auth-token"]; phase = "start";
          } else if (phase === "start") {
            if (next.source !== "carrier") throw Error("stream_start_required");
            streamId = startFrame.parse(JSON.parse(next.raw)).stream_id; phase = "starting";
            bridge = await startMediaBridge({ headers, connectedToken, rawStart: next.raw, trusted: config }, {
              carrier: socketPort(carrier, fail),
              openRealtime: async (_url, sessionId) => {
                if (closed) throw Error("carrier_closed_before_realtime");
                realtime = await openRealtimeSocket(config.realtime, raw => enqueue("xai", raw), fail, sessionId);
                if (closed) { realtime.terminate(); throw Error("carrier_closed_during_realtime"); }
                realtimePong = performance.now(); realtime.on("pong", () => { realtimePong = performance.now(); });
                return socketPort(realtime, fail);
              },
            });
            if (closed) { await bridge.stop("listener_closed_during_start"); break; }
            if (startup) bridge.discardStartup(startup);
            startup = undefined;
            phase = "active"; clearTimeout(startDeadline); connectedToken = undefined;
          } else if (next.source === "carrier") await bridge!.carrier(next.raw);
          else await bridge!.xai(next.raw);
        }
      } catch { onFault(); fail(); }
      finally { pumping = false; }
    }
  }
  async function close() {
    for (const stop of shutdowns) stop();
    while (pending.size) await Promise.allSettled([...pending]);
    await new Promise<void>(resolve => wss.close(() => resolve()));
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
  return { server, close };
}
