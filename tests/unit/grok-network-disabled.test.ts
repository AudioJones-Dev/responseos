import { expect, test, vi } from "vitest";
import { createCarrierTransport, openRealtimeSocket, type TransportConfig } from "@/lib/grok/networkTransport";
import { createGrokMediaServer, parseMediaListenerConfig } from "@/lib/grok/mediaServer";

test("production network transports reject before reading credentials or opening sockets", async () => {
  const apiKey = vi.fn(() => "must-not-be-read"), config = { mode: "production" as const, apiKey };
  await expect(openRealtimeSocket(config, vi.fn(), vi.fn())).rejects.toThrow("unqualified");
  await expect(createCarrierTransport(config).hangup("call", "command")).rejects.toThrow("unqualified");
  expect(() => createGrokMediaServer({ streamUrl: "wss://example.invalid/media", publicKey: "", tls: {}, realtime: config })).toThrow("unqualified");
  expect(() => createGrokMediaServer({ streamUrl: "wss://example.invalid/media", publicKey: "", ingress: "managed-edge-http", realtime: config })).toThrow("unqualified");
  expect(apiKey).not.toHaveBeenCalled();
});

test("listener defaults to direct TLS; managed edge requires explicit ingress and PORT", () => {
  const common = { mode: "production", streamUrl: "wss://example.invalid/media", publicKey: "public" };
  expect(parseMediaListenerConfig({ ...common, certificatePath: "/cert", privateKeyPath: "/key", port: 8443 }, "9000")).toMatchObject({ ingress: "direct-tls", port: 8443 });
  expect(parseMediaListenerConfig({ ...common, ingress: "managed-edge-http" }, "9000")).toMatchObject({ ingress: "managed-edge-http", port: 9000 });
  for (const port of [undefined, "", "0", "443", "65536", "01", "3000x", " 3000"]) expect(() => parseMediaListenerConfig({ ...common, ingress: "managed-edge-http" }, port)).toThrow();
  for (const extra of [{}, { ingress: "unknown" }, { ingress: "managed-edge-http", port: 9000 }, { ingress: "managed-edge-http", certificatePath: "/cert" }]) expect(() => parseMediaListenerConfig({ ...common, ...extra }, "9000")).toThrow();
});
test.each(["https://example.com", "http://127.0.0.1:1234", "https://localhost:1234", "https://127.0.0.1:1234/path"])("synthetic mode rejects nonliteral loopback TLS origin %s", async origin => {
  await expect(openRealtimeSocket({ mode: "local-synthetic", origin, ca: Buffer.from("synthetic") }, vi.fn(), vi.fn())).rejects.toThrow("loopback_tls");
});
test("missing or unknown transport mode fails closed", async () => {
  await expect(openRealtimeSocket({ mode: "unknown" } as unknown as TransportConfig, vi.fn(), vi.fn())).rejects.toThrow("transport_mode_required");
});
