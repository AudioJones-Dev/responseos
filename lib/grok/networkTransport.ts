import "@/lib/serverOnlyGuard";
import { request } from "node:https";
import WebSocket from "ws";
import type { GrokCallSession } from "@prisma/client";
import { assertGrokQualified, type CommandResult } from "./provider";
import { REALTIME_URL, streamingStartBody } from "./mediaContract";
import type { MediaSocket } from "./mediaBridge";

export type TransportConfig = { mode: "production"; apiKey: () => string } | { mode: "local-synthetic"; origin: string; ca: Buffer };

function endpoint(config: TransportConfig, production: string) {
  if (config.mode === "production") {
    assertGrokQualified();
    const key = config.apiKey();
    if (!key || /[\s\r\n]/.test(key)) throw Error("transport_credential_invalid");
    return { url: new URL(production), key, ca: undefined };
  }
  if (config.mode !== "local-synthetic") throw Error("transport_mode_required");
  const origin = new URL(config.origin);
  if (origin.protocol !== "https:" || origin.hostname !== "127.0.0.1" || !origin.port || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash || !config.ca.length) throw Error("synthetic_transport_requires_loopback_tls");
  const desired = new URL(production);
  return { url: new URL(desired.pathname + desired.search, origin), key: "local-synthetic-only", ca: config.ca };
}

export function socketPort(socket: WebSocket, lost: () => void): MediaSocket {
  return {
    get bufferedAmount() { return socket.bufferedAmount; },
    send(data) {
      if (socket.readyState !== WebSocket.OPEN) throw Error("socket_not_open");
      socket.send(data, error => { if (error) lost(); });
    },
    close() { socket.terminate(); },
  };
}

export function openRealtimeSocket(config: TransportConfig, message: (raw: string) => void, lost: () => void): Promise<WebSocket> {
  const target = endpoint(config, REALTIME_URL);
  target.url.protocol = "wss:";
  return new Promise((resolve, reject) => {
    const options = { headers: { Authorization: `Bearer ${target.key}` }, ca: target.ca, rejectUnauthorized: true, followRedirects: false, perMessageDeflate: false, maxPayload: 16384, maxFragments: 64, maxBufferedChunks: 64, handshakeTimeout: 4000, closeTimeout: 1000 };
    const socket = new WebSocket(target.url, options);
    socket.once("open", () => resolve(socket));
    socket.on("error", () => { reject(Error("realtime_connection_failed")); lost(); });
    socket.on("close", () => { reject(Error("realtime_connection_closed")); lost(); });
    socket.on("unexpected-response", (_request, response) => { response.destroy(); socket.terminate(); reject(Error("realtime_upgrade_rejected")); lost(); });
    socket.on("message", (data, binary) => { if (binary) { socket.terminate(); lost(); } else message(data.toString()); });
  });
}

export function createCarrierTransport(config: TransportConfig) {
  async function command(call: string, action: "streaming_start" | "hangup", body: unknown): Promise<CommandResult> {
    const target = endpoint(config, `https://api.telnyx.com/v2/calls/${encodeURIComponent(call)}/actions/${action}`);
    return new Promise(resolve => {
      let settled = false;
      const finish = (value: CommandResult) => { if (!settled) { settled = true; resolve(value); } };
      const bytes = Buffer.from(JSON.stringify(body));
      const req = request(target.url, { method: "POST", ca: target.ca, rejectUnauthorized: true, headers: { Authorization: `Bearer ${target.key}`, "Content-Type": "application/json", "Content-Length": bytes.length } }, response => {
        let size = 0;
        response.on("data", chunk => { size += chunk.length; if (size > 65536) { response.destroy(); finish("uncertain"); } });
        response.on("error", () => finish("uncertain"));
        response.on("end", () => finish(response.statusCode && response.statusCode >= 200 && response.statusCode < 300 ? "accepted" : "uncertain"));
      });
      const timer = setTimeout(() => { req.destroy(); finish("uncertain"); }, 4000);
      req.on("close", () => clearTimeout(timer));
      req.on("error", () => finish("uncertain"));
      req.end(bytes);
    });
  }
  return {
    start(session: GrokCallSession, token: string, streamUrl: string, commandId: string) { return command(session.provider_call_id, "streaming_start", streamingStartBody(session, token, streamUrl, commandId)); },
    hangup(call: string, commandId: string) { return command(call, "hangup", { command_id: commandId }); },
  };
}
