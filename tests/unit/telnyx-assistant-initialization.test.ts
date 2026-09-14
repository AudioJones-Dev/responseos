import { generateKeyPairSync, sign } from "node:crypto";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  recordWebhookEvent: vi.fn(),
  setWebhookProcessStatus: vi.fn(),
  resolveActiveProspectAgentContext: vi.fn(),
  resolveSupervisedTenantForNumber: vi.fn(),
  isSupervisedNumber: vi.fn(),
}));

vi.mock("@/lib/data/webhookEvents", () => ({
  recordWebhookEvent: mocks.recordWebhookEvent,
  setWebhookProcessStatus: mocks.setWebhookProcessStatus,
}));
vi.mock("@/lib/prospectBootstrap/service", () => ({
  resolveActiveProspectAgentContext: mocks.resolveActiveProspectAgentContext,
}));
vi.mock("@/lib/agentExecution/supervisedRuntime", () => ({
  resolveSupervisedTenantForNumber: mocks.resolveSupervisedTenantForNumber,
  isSupervisedNumber: mocks.isSupervisedNumber,
}));

const originalEnv = { ...process.env };
const keys = generateKeyPairSync("ed25519");
const publicKey = keys.publicKey.export({ type: "spki", format: "pem" }).toString();

function signedRequest(target = "+13055550101", mutateSignature = false) {
  const rawBody = JSON.stringify({
    data: {
      id: "init-event-1",
      event_type: "assistant.initialization",
      occurred_at: new Date().toISOString(),
      payload: { telnyx_agent_target: target },
    },
  });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = sign(null, Buffer.from(`${timestamp}|${rawBody}`), keys.privateKey).toString("base64");
  return new Request("https://responseos.example/api/webhooks/telnyx/assistant-initialization", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "telnyx-timestamp": timestamp,
      "telnyx-signature-ed25519": mutateSignature ? `${signature.slice(0, -2)}xx` : signature,
    },
    body: rawBody,
  });
}

describe("signed Telnyx assistant initialization", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.isSupervisedNumber.mockResolvedValue(false);
    process.env = { ...originalEnv };
    process.env.TELNYX_PUBLIC_KEY = publicKey;
    process.env.RESPONSEOS_LIVE_TELNYX_INGEST_ENABLED = "true";
    process.env.RESPONSEOS_PROSPECT_BOOTSTRAP_ENABLED = "true";
    mocks.recordWebhookEvent.mockResolvedValue({ ok: true, data: { id: "ledger-1", process_status: "received" } });
    mocks.setWebhookProcessStatus.mockResolvedValue({ ok: true, data: undefined });
    mocks.resolveSupervisedTenantForNumber.mockResolvedValue(null);
  });
  afterEach(() => { process.env = { ...originalEnv }; });

  test.each(["PRODUCTION_SUPERVISED", "MANAGED_AUTONOMY"])("does not initialize the out-of-scope %s mode", async (mode) => {
    mocks.resolveSupervisedTenantForNumber.mockResolvedValue({ accountId: "fixture", readiness: { ready: true }, resolved: { mode, degraded: null } });
    const { POST } = await import("@/app/api/webhooks/telnyx/assistant-initialization/route");
    const response = await POST(signedRequest());
    expect(await response.json()).toMatchObject({ dynamic_variables: { supervised_available: "false" } });
  });

  test("requires the live ingest gate before anything is resolved or recorded", async () => {
    delete process.env.RESPONSEOS_LIVE_TELNYX_INGEST_ENABLED;
    const { POST } = await import("@/app/api/webhooks/telnyx/assistant-initialization/route");
    expect((await POST(signedRequest())).status).toBe(503);
    expect(mocks.recordWebhookEvent).not.toHaveBeenCalled();
  });

  // The supervised lane answers on this endpoint too (ADR-0052), so the
  // prospect-bootstrap flag gates the prospect branch rather than the route.
  test("keeps the prospect branch behind its own gate and answers unavailable without it", async () => {
    delete process.env.RESPONSEOS_PROSPECT_BOOTSTRAP_ENABLED;
    const { POST } = await import("@/app/api/webhooks/telnyx/assistant-initialization/route");
    const response = await POST(signedRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      dynamic_variables: { demo_available: "false", execution_mode: "PROSPECT_DEMO_UNAVAILABLE" },
    });
    expect(mocks.resolveActiveProspectAgentContext).not.toHaveBeenCalled();
  });

  test("rejects an invalid signature before resolution or persistence", async () => {
    const { POST } = await import("@/app/api/webhooks/telnyx/assistant-initialization/route");
    expect((await POST(signedRequest("+13055550101", true))).status).toBe(401);
    expect(mocks.resolveActiveProspectAgentContext).not.toHaveBeenCalled();
    expect(mocks.recordWebhookEvent).not.toHaveBeenCalled();
  });

  test("returns only the resolved assignment context and ledgers the signed event", async () => {
    mocks.resolveActiveProspectAgentContext.mockResolvedValue({
      accountId: "account-alpha",
      bootstrapId: "bootstrap-alpha",
      assignmentId: "assignment-alpha",
      demoNumber: "+13055550101",
      context: {
        demo_available: "true",
        execution_mode: "PROSPECT_DEMO",
        business_name: "Alpha Roofing",
        business_website: "https://alpha.example/",
        approved_business_context: "contact.phone: +13055550111",
        knowledge_as_of: "2026-08-20T16:00:00.000Z",
        uncertainty_fallback: "I don't have verified information available for that. I can capture a request for a human callback.",
      },
    });
    const { POST } = await import("@/app/api/webhooks/telnyx/assistant-initialization/route");
    const response = await POST(signedRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      dynamic_variables: { business_name: "Alpha Roofing", execution_mode: "PROSPECT_DEMO" },
      conversation: { metadata: { responseos_account_id: "account-alpha", responseos_assignment_id: "assignment-alpha" } },
    });
    expect(mocks.recordWebhookEvent).toHaveBeenCalledWith(expect.objectContaining({
      account_id: "account-alpha",
      provider_event_id: "init-event-1",
      signature_valid: true,
    }));
    expect(mocks.setWebhookProcessStatus).toHaveBeenCalledWith({ id: "ledger-1", process_status: "processed" });
  });

  test("an owned supervised number whose runtime fails closed never hears demonstration copy", async () => {
    mocks.resolveSupervisedTenantForNumber.mockResolvedValue(null);
    mocks.isSupervisedNumber.mockResolvedValue(true);
    mocks.resolveActiveProspectAgentContext.mockResolvedValue({ accountId: "prospect", context: { demo_available: "true" } });
    const { POST } = await import("@/app/api/webhooks/telnyx/assistant-initialization/route");
    const response = await POST(signedRequest("+13055550777"));
    const body = await response.json();
    expect(body).toMatchObject({ conversation: { metadata: { execution_mode: "SUPERVISED_UNAVAILABLE" } } });
    expect(JSON.stringify(body)).not.toContain("demonstration");
    expect(mocks.resolveActiveProspectAgentContext).not.toHaveBeenCalled();
    expect(mocks.setWebhookProcessStatus).toHaveBeenCalledWith(expect.objectContaining({ process_status: "rejected", process_error: "supervised_runtime_unresolved" }));
  });

  test("uses the generic unavailable context when no assignment resolves", async () => {
    mocks.resolveActiveProspectAgentContext.mockResolvedValue(null);
    const { POST } = await import("@/app/api/webhooks/telnyx/assistant-initialization/route");
    const response = await POST(signedRequest("+13055550999"));
    expect(await response.json()).toMatchObject({
      dynamic_variables: { demo_available: "false", execution_mode: "PROSPECT_DEMO_UNAVAILABLE" },
      conversation: { metadata: { execution_mode: "PROSPECT_DEMO_UNAVAILABLE" } },
    });
    expect(mocks.recordWebhookEvent).toHaveBeenCalledWith(expect.objectContaining({ account_id: undefined }));
  });
});
