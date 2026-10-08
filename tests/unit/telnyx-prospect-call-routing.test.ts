import { generateKeyPairSync, sign } from "node:crypto";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  recordWebhookEvent: vi.fn(),
  setWebhookProcessStatus: vi.fn(),
  resolveTelnyxEventAssignment: vi.fn(),
}));

vi.mock("@/lib/data/webhookEvents", () => ({
  recordWebhookEvent: mocks.recordWebhookEvent,
  setWebhookProcessStatus: mocks.setWebhookProcessStatus,
  getWebhookProcessingState: vi.fn(),
}));
vi.mock("@/lib/prospectBootstrap/service", () => ({
  resolveTelnyxEventAssignment: mocks.resolveTelnyxEventAssignment,
}));
vi.mock("@/lib/crm/syncFinalizedCall", () => ({ runCrmSyncForCall: vi.fn() }));
vi.mock("@/lib/providers/telnyx/normalize", () => ({ normalizeTelnyxEvent: vi.fn() }));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: vi.fn(),
}));

const originalEnv = { ...process.env };
const keys = generateKeyPairSync("ed25519");
const publicKey = keys.publicKey.export({ type: "spki", format: "pem" }).toString();

function signedRequestWithoutOccurredAt() {
  const rawBody = JSON.stringify({
    data: {
      id: "missing-time-event",
      event_type: "call.conversation.ended",
      payload: { telnyx_agent_target: "+13055550101", call_control_id: "call-1" },
    },
  });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = sign(null, Buffer.from(`${timestamp}|${rawBody}`), keys.privateKey).toString("base64");
  return new Request("https://responseos.example/api/webhooks/telnyx/calls", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "telnyx-timestamp": timestamp,
      "telnyx-signature-ed25519": signature,
    },
    body: rawBody,
  });
}

describe("personalized Telnyx call retention", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.TELNYX_PUBLIC_KEY = publicKey;
    process.env.RESPONSEOS_LIVE_TELNYX_INGEST_ENABLED = "true";
    process.env.RESPONSEOS_PROSPECT_BOOTSTRAP_ENABLED = "true";
    delete process.env.RESPONSEOS_DEMO_ACCOUNT_ID;
    delete process.env.RESPONSEOS_DEMO_PHONE_E164;
    mocks.recordWebhookEvent.mockResolvedValue({ ok: true, data: { id: "ledger-1", process_status: "received" } });
    mocks.setWebhookProcessStatus.mockResolvedValue(undefined);
  });
  afterEach(() => { process.env = { ...originalEnv }; });

  test("assigns a 30-day expiry even when a signed event lacks occurred_at", async () => {
    const before = Date.now();
    const { POST } = await import("@/app/api/webhooks/telnyx/calls/route");
    const response = await POST(signedRequestWithoutOccurredAt());
    expect(response.status).toBe(202);
    const entry = mocks.recordWebhookEvent.mock.calls[0][0] as { payload_expires_at: Date };
    expect(entry.payload_expires_at).toBeInstanceOf(Date);
    expect(entry.payload_expires_at.getTime()).toBeGreaterThanOrEqual(before + 30 * 24 * 60 * 60 * 1000);
    expect(mocks.setWebhookProcessStatus).toHaveBeenCalledWith(expect.objectContaining({ process_error: "missing_occurred_at" }));
  });

  test("assigns general demo payloads a 90-day expiry from occurred_at", async () => {
    process.env.RESPONSEOS_DEMO_ACCOUNT_ID = "demo-account";
    process.env.RESPONSEOS_DEMO_PHONE_E164 = "+13055550199";
    mocks.resolveTelnyxEventAssignment.mockResolvedValue(null);
    const occurredAt = new Date(Date.now() - 60_000);
    const rawBody = JSON.stringify({
      data: {
        id: "general-demo-event",
        event_type: "call.conversation.ended",
        occurred_at: occurredAt.toISOString(),
        payload: { telnyx_agent_target: "+13055550199", call_control_id: "call-2" },
      },
    });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = sign(null, Buffer.from(`${timestamp}|${rawBody}`), keys.privateKey).toString("base64");
    const { POST } = await import("@/app/api/webhooks/telnyx/calls/route");
    await POST(new Request("https://responseos.example/api/webhooks/telnyx/calls", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "telnyx-timestamp": timestamp,
        "telnyx-signature-ed25519": signature,
      },
      body: rawBody,
    }));
    const entry = mocks.recordWebhookEvent.mock.calls[0][0] as { account_id: string; payload_expires_at: Date };
    expect(entry.account_id).toBe("demo-account");
    expect(entry.payload_expires_at.getTime()).toBe(occurredAt.getTime() + 90 * 24 * 60 * 60 * 1000);
  });

  test("does not store or normalize an event that arrives after its call's retention window", async () => {
    process.env.RESPONSEOS_DEMO_ACCOUNT_ID = "demo-account";
    process.env.RESPONSEOS_DEMO_PHONE_E164 = "+13055550199";
    mocks.resolveTelnyxEventAssignment.mockResolvedValue(null);
    const occurredAt = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000);
    const rawBody = JSON.stringify({
      data: {
        id: "late-general-demo-event",
        event_type: "call.conversation.ended",
        occurred_at: occurredAt.toISOString(),
        payload: { telnyx_agent_target: "+13055550199", call_control_id: "call-3", from: "+13055550142" },
      },
    });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = sign(null, Buffer.from(`${timestamp}|${rawBody}`), keys.privateKey).toString("base64");
    const { after } = await import("next/server");
    const { POST } = await import("@/app/api/webhooks/telnyx/calls/route");
    const response = await POST(new Request("https://responseos.example/api/webhooks/telnyx/calls", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "telnyx-timestamp": timestamp,
        "telnyx-signature-ed25519": signature,
      },
      body: rawBody,
    }));
    expect(response.status).toBe(202);
    const entry = mocks.recordWebhookEvent.mock.calls[0][0] as {
      raw_body: string;
      signature_header?: string;
      payload_purged_at?: Date;
    };
    expect(entry.raw_body).toBe("<PURGED_WEBHOOK_PAYLOAD>");
    expect(entry.signature_header).toBeUndefined();
    expect(entry.payload_purged_at).toBeInstanceOf(Date);
    expect(mocks.setWebhookProcessStatus).toHaveBeenCalledWith(
      expect.objectContaining({ process_status: "rejected", process_error: "past_retention_window" }),
    );
    expect(after).not.toHaveBeenCalled();
  });
});
