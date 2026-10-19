import { expect, test, vi } from "vitest";
import { createCarrierTransport, openRealtimeSocket, type TransportConfig } from "@/lib/grok/networkTransport";
import { createGrokMediaServer } from "@/lib/grok/mediaServer";

test("production network transports reject before reading credentials or opening sockets", async () => {
  const apiKey = vi.fn(() => "must-not-be-read"), config = { mode: "production" as const, apiKey };
  expect(() => openRealtimeSocket(config, vi.fn(), vi.fn())).toThrow("unqualified");
  await expect(createCarrierTransport(config).hangup("call", "command")).rejects.toThrow("unqualified");
  expect(() => createGrokMediaServer({ streamUrl: "wss://example.invalid/media", publicKey: "", tls: {}, realtime: config })).toThrow("unqualified");
  expect(apiKey).not.toHaveBeenCalled();
});
test.each(["https://example.com", "http://127.0.0.1:1234", "https://localhost:1234", "https://127.0.0.1:1234/path"])("synthetic mode rejects nonliteral loopback TLS origin %s", origin => {
  expect(() => openRealtimeSocket({ mode: "local-synthetic", origin, ca: Buffer.from("synthetic") }, vi.fn(), vi.fn())).toThrow("loopback_tls");
});
test("missing or unknown transport mode fails closed", () => {
  expect(() => openRealtimeSocket({ mode: "unknown" } as unknown as TransportConfig, vi.fn(), vi.fn())).toThrow("transport_mode_required");
});
