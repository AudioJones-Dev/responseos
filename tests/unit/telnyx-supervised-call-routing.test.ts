import { generateKeyPairSync, sign } from "node:crypto";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { EXECUTION_MODE_POLICIES } from "@/lib/agentExecution/policy";
import { PROSPECT_DEMO_POLICY } from "@/lib/prospectBootstrap/policy";

const mocks = vi.hoisted(() => ({
  recordWebhookEvent: vi.fn(),
  setWebhookProcessStatus: vi.fn(),
  findAgentTargetForProviderCall: vi.fn(),
  resolveTelnyxEventAssignment: vi.fn(),
  resolveSupervisedTenantForNumber: vi.fn(),
  touchSupervisedAssignment: vi.fn(),
  normalizeTelnyxEvent: vi.fn(),
  runCrmSyncForCall: vi.fn(),
  dispatchCompletedInteractionNotification: vi.fn(),
  canRetainCallContent: vi.fn(),
  queueCallReview: vi.fn(),
  pending: [] as Promise<unknown>[],
}));

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (callback: () => Promise<unknown>) => {
    mocks.pending.push(Promise.resolve().then(callback));
  },
}));
vi.mock("@/lib/data/webhookEvents", () => ({
  recordWebhookEvent: mocks.recordWebhookEvent,
  setWebhookProcessStatus: mocks.setWebhookProcessStatus,
  findAgentTargetForProviderCall: mocks.findAgentTargetForProviderCall,
  getWebhookProcessingState: vi.fn(),
}));
vi.mock("@/lib/prospectBootstrap/service", () => ({
  resolveTelnyxEventAssignment: mocks.resolveTelnyxEventAssignment,
}));
vi.mock("@/lib/agentExecution/supervisedRuntime", () => ({
  resolveSupervisedTenantForNumber: mocks.resolveSupervisedTenantForNumber,
  touchSupervisedAssignment: mocks.touchSupervisedAssignment,
}));
vi.mock("@/lib/providers/telnyx/normalize", () => ({ normalizeTelnyxEvent: mocks.normalizeTelnyxEvent }));
vi.mock("@/lib/crm/syncFinalizedCall", () => ({ runCrmSyncForCall: mocks.runCrmSyncForCall }));
vi.mock("@/lib/notifications/completedInteraction", () => ({
  dispatchCompletedInteractionNotification: mocks.dispatchCompletedInteractionNotification,
}));

vi.mock("@/lib/callReview/service", () => ({ queueCallReview: mocks.queueCallReview }));
vi.mock("@/lib/callReview/consent", async (original) => ({ ...await original<typeof import("@/lib/callReview/consent")>(), canRetainCallContent: mocks.canRetainCallContent, withCaptureLock: (_account: string, _provider: string, run: () => Promise<unknown>) => run() }));
const originalEnv = { ...process.env };
const keys = generateKeyPairSync("ed25519");
const publicKey = keys.publicKey.export({ type: "spki", format: "pem" }).toString();
const TENANT_NUMBER = "+15555550188";

function signedEvent(payload: Record<string, unknown>, eventType = "call.conversation_insights.generated") {
  const rawBody = JSON.stringify({
    data: {
      id: `event-${Math.random().toString(36).slice(2)}`,
      event_type: eventType,
      occurred_at: new Date().toISOString(),
      payload,
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

function supervisedTenant(policy = EXECUTION_MODE_POLICIES.SUPERVISED_PILOT) {
  return {
    accountId: "account-supervised",
    accountName: "Example Business",
    assignmentId: "assignment-1",
    numberE164: TENANT_NUMBER,
    agentName: "Sam",
    profileId: "profile-1",
    memory: { generatedAt: "2026-09-11T12:00:00.000Z" },
    resolved: { mode: policy.executionMode, declaredMode: "SUPERVISED_PILOT", policy, recordingSource: "policy_default", degraded: null },
    readiness: { ready: true, missing: [], conflicts: [] },
  };
}

async function settle() {
  await Promise.all(mocks.pending);
  mocks.pending.length = 0;
}

describe("supervised Telnyx call lane", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.pending.length = 0;
    mocks.canRetainCallContent.mockResolvedValue(true);
    process.env = { ...originalEnv };
    process.env.TELNYX_PUBLIC_KEY = publicKey;
    process.env.RESPONSEOS_LIVE_TELNYX_INGEST_ENABLED = "true";
    delete process.env.RESPONSEOS_PROSPECT_BOOTSTRAP_ENABLED;
    delete process.env.RESPONSEOS_DEMO_ACCOUNT_ID;
    delete process.env.RESPONSEOS_DEMO_PHONE_E164;
    mocks.recordWebhookEvent.mockResolvedValue({ ok: true, data: { id: "ledger-1", process_status: "received" } });
    mocks.setWebhookProcessStatus.mockResolvedValue(undefined);
    mocks.findAgentTargetForProviderCall.mockResolvedValue(null);
    mocks.resolveTelnyxEventAssignment.mockResolvedValue(null);
    mocks.resolveSupervisedTenantForNumber.mockResolvedValue(null);
    mocks.normalizeTelnyxEvent.mockResolvedValue({ callId: "call-1", finalized: true });
    mocks.runCrmSyncForCall.mockResolvedValue({ ok: true });
    mocks.dispatchCompletedInteractionNotification.mockResolvedValue({ ok: true });
  });
  afterEach(() => { process.env = { ...originalEnv }; });

  test("queues consented evidence without CRM or email effects", async () => {
    mocks.resolveSupervisedTenantForNumber.mockResolvedValue(supervisedTenant());
    const { POST } = await import("@/app/api/webhooks/telnyx/calls/route");
    const response = await POST(signedEvent({ call_control_id: "call-a", to: TENANT_NUMBER }));
    await settle();

    expect(response.status).toBe(202);
    expect(mocks.normalizeTelnyxEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "account-supervised",
        demoNumber: TENANT_NUMBER,
        options: { captureCallerIdentity: true, createQuoteRequest: false, reviewRequired: true },
      }),
    );
    expect(mocks.normalizeTelnyxEvent.mock.calls[0][0]).not.toHaveProperty("transcriptExpiresAt");
    expect(mocks.runCrmSyncForCall).not.toHaveBeenCalled();
    expect(mocks.dispatchCompletedInteractionNotification).not.toHaveBeenCalled();
    expect(mocks.queueCallReview).toHaveBeenCalled();
    expect(mocks.touchSupervisedAssignment).toHaveBeenCalled();
  });

  test("retains the raw payload for a real client instead of expiring it on the prospect clock", async () => {
    mocks.resolveSupervisedTenantForNumber.mockResolvedValue(supervisedTenant());
    const { POST } = await import("@/app/api/webhooks/telnyx/calls/route");
    await POST(signedEvent({ call_control_id: "call-b", to: TENANT_NUMBER }));
    await settle();
    expect(mocks.recordWebhookEvent.mock.calls[0][0]).not.toHaveProperty("payload_expires_at");
    expect(mocks.recordWebhookEvent).toHaveBeenCalledWith(
      expect.objectContaining({ provider_call_id: "call-b", agent_target: TENANT_NUMBER }),
    );
  });

  test("recovers the tenant for an insight event that carries no called number", async () => {
    mocks.findAgentTargetForProviderCall.mockResolvedValue(TENANT_NUMBER);
    mocks.resolveSupervisedTenantForNumber.mockResolvedValue(supervisedTenant());
    const { POST } = await import("@/app/api/webhooks/telnyx/calls/route");
    await POST(signedEvent({ call_control_id: "call-c", call_session_id: "session-c", results: [] }));
    await settle();

    expect(mocks.findAgentTargetForProviderCall).toHaveBeenCalledWith({
      provider: "telnyx",
      providerCallIds: ["call-c", "session-c"],
    });
    expect(mocks.resolveSupervisedTenantForNumber).toHaveBeenCalledWith(TENANT_NUMBER, expect.any(Date));
    expect(mocks.normalizeTelnyxEvent).toHaveBeenCalled();
    // A correlated number is not re-anchored: only a number the provider put
    // on this event may become a correlation source.
    expect(mocks.recordWebhookEvent.mock.calls[0][0].agent_target).toBeUndefined();
  });

  test("rejects a destination-less event that correlates to nothing, distinctly", async () => {
    const { POST } = await import("@/app/api/webhooks/telnyx/calls/route");
    const response = await POST(signedEvent({ call_control_id: "call-d", results: [] }));
    await settle();

    expect(response.status).toBe(202);
    expect(mocks.setWebhookProcessStatus).toHaveBeenCalledWith(
      expect.objectContaining({ process_error: "awaiting_call_correlation" }),
    );
    expect(mocks.normalizeTelnyxEvent).not.toHaveBeenCalled();
  });

  test("writes nothing to the CRM when the tenant degraded to the demo policy", async () => {
    mocks.resolveSupervisedTenantForNumber.mockResolvedValue({
      ...supervisedTenant(PROSPECT_DEMO_POLICY),
      resolved: {
        mode: "PROSPECT_DEMO",
        declaredMode: "SUPERVISED_PILOT",
        policy: PROSPECT_DEMO_POLICY,
        recordingSource: "policy_default",
        degraded: "gate_not_authorized",
      },
    });
    const { POST } = await import("@/app/api/webhooks/telnyx/calls/route");
    await POST(signedEvent({ call_control_id: "call-e", to: TENANT_NUMBER }));
    await settle();

    expect(mocks.normalizeTelnyxEvent).toHaveBeenCalled();
    expect(mocks.runCrmSyncForCall).not.toHaveBeenCalled();
  });

  test("leaves the legacy demo lane exactly as it was", async () => {
    process.env.RESPONSEOS_DEMO_ACCOUNT_ID = "org_responseos_demo";
    process.env.RESPONSEOS_DEMO_PHONE_E164 = "+17867560897";
    const { POST } = await import("@/app/api/webhooks/telnyx/calls/route");
    await POST(signedEvent({ call_control_id: "call-f", to: "+17867560897" }));
    await settle();

    expect(mocks.runCrmSyncForCall).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: "org_responseos_demo", callId: "call-1" }),
    );
    expect(mocks.runCrmSyncForCall.mock.calls[0][0]).not.toHaveProperty("requireLiveProvider");
    expect(mocks.dispatchCompletedInteractionNotification).not.toHaveBeenCalled();
  });

  test("does not fail the call when the notification throws", async () => {
    mocks.resolveSupervisedTenantForNumber.mockResolvedValue(supervisedTenant());
    mocks.dispatchCompletedInteractionNotification.mockRejectedValue(new Error("email_http_500"));
    const { POST } = await import("@/app/api/webhooks/telnyx/calls/route");
    const response = await POST(signedEvent({ call_control_id: "call-g", to: TENANT_NUMBER }));
    await settle();

    expect(response.status).toBe(202);
    expect(mocks.setWebhookProcessStatus).not.toHaveBeenCalledWith(
      expect.objectContaining({ process_status: "error" }),
    );
  });
});
