import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ingest: vi.fn(),
  verify: vi.fn(),
}));

vi.mock("@/lib/callControl/service", () => ({ ingestCallControlEvent: mocks.ingest }));
vi.mock("@/lib/providers/telnyx/webhook", () => ({ verifyTelnyxWebhook: mocks.verify }));

const body = JSON.stringify({
  data: {
    id: "event-1",
    event_type: "call.initiated",
    occurred_at: "2026-09-16T12:00:00.000Z",
    payload: { call_control_id: "control-1", call_session_id: "session-1", to: "+15555550188" },
  },
});
const originalEnv = { ...process.env };

describe("Telnyx Call Control route", () => {
  beforeEach(() => {
    process.env.RESPONSEOS_LIVE_TELNYX_INGEST_ENABLED = "true";
    process.env.TELNYX_PUBLIC_KEY = "test-public-key";
    mocks.verify.mockReset().mockReturnValue({ ok: true });
    mocks.ingest.mockReset().mockResolvedValue({ duplicate: false, captureId: "capture-1" });
  });
  afterEach(() => { process.env = { ...originalEnv }; });

  test("acknowledges accepted signed JSON with the provider-required HTTP 200", async () => {
    const { POST } = await import("@/app/api/webhooks/telnyx/call-control/route");
    const response = await POST(new Request("https://responseos.example/api/webhooks/telnyx/call-control", {
      method: "POST",
      headers: { "content-type": "application/json", "telnyx-timestamp": "1", "telnyx-signature-ed25519": "signature" },
      body,
    }));
    expect(response.status).toBe(200);
    expect(mocks.ingest).toHaveBeenCalledOnce();
  });

  test("rejects TeXML form callbacks before parsing", async () => {
    const { POST } = await import("@/app/api/webhooks/telnyx/call-control/route");
    const response = await POST(new Request("https://responseos.example/api/webhooks/telnyx/call-control", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "CallStatus=completed&CallSid=abc",
    }));
    expect(response.status).toBe(415);
    expect(mocks.ingest).not.toHaveBeenCalled();
  });
});
