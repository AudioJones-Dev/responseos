import { generateKeyPairSync, sign } from "node:crypto";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  after: vi.fn(), ledger: vi.fn(), status: vi.fn(), assignment: vi.fn(), normalize: vi.fn(), sync: vi.fn(),
}));
vi.mock("next/server", () => ({ after: mocks.after, NextResponse: { json: (data: unknown, init?: ResponseInit) => Response.json(data, init) } }));
vi.mock("@/lib/data/webhookEvents", () => ({ recordWebhookEvent: mocks.ledger, setWebhookProcessStatus: mocks.status, getWebhookProcessingState: vi.fn() }));
vi.mock("@/lib/prospectBootstrap/service", () => ({ resolveTelnyxEventAssignment: mocks.assignment }));
vi.mock("@/lib/providers/telnyx/normalize", () => ({ normalizeTelnyxEvent: mocks.normalize }));
vi.mock("@/lib/crm/qualifiedCallHandoff", () => ({ syncFinalizedCallAndPrepareHandoff: mocks.sync }));

const keys = generateKeyPairSync("ed25519");
const publicKey = keys.publicKey.export({ type: "spki", format: "pem" }).toString();
function request(valid = true) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify({ data: { id: "synthetic-event", event_type: "call.conversation_insights.generated",
    occurred_at: new Date().toISOString(), payload: { telnyx_agent_target: "+15555550101", call_control_id: "synthetic-call" } } });
  return new Request("https://responseos.example/api/webhooks/telnyx/calls", { method: "POST", body,
    headers: { "telnyx-timestamp": timestamp,
      "telnyx-signature-ed25519": valid ? sign(null, Buffer.from(`${timestamp}|${body}`), keys.privateKey).toString("base64") : "invalid" } });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("TELNYX_PUBLIC_KEY", publicKey);
  vi.stubEnv("RESPONSEOS_LIVE_TELNYX_INGEST_ENABLED", "true");
  vi.stubEnv("RESPONSEOS_PROSPECT_BOOTSTRAP_ENABLED", "true");
  vi.stubEnv("RESPONSEOS_FRL_HANDOFF_ACCOUNT_ID", "synthetic-tenant");
  vi.stubEnv("RESPONSEOS_FRL_QUALIFIED_HANDOFF_ENABLED", "true");
  mocks.assignment.mockResolvedValue({ accountId: "synthetic-tenant", demoNumber: "+15555550101" });
  mocks.ledger.mockResolvedValue({ ok: true, data: { id: "synthetic-ledger", process_status: "received" } });
  mocks.normalize.mockResolvedValue({ finalized: true, callId: "synthetic-call" });
});
afterEach(() => vi.unstubAllEnvs());

test("only signed, normalized final call from explicitly enabled tenant reaches CRM/handoff", async () => {
  const { POST } = await import("@/app/api/webhooks/telnyx/calls/route");
  expect((await POST(request())).status).toBe(202);
  expect(mocks.sync).not.toHaveBeenCalled();
  await mocks.after.mock.calls[0][0]();
  expect(mocks.sync).toHaveBeenCalledWith({ accountId: "synthetic-tenant", callId: "synthetic-call", sourceWebhookId: "synthetic-ledger" });
});

test("invalid signature stops before ledger and business mutation", async () => {
  const { POST } = await import("@/app/api/webhooks/telnyx/calls/route");
  expect((await POST(request(false))).status).toBe(401);
  expect(mocks.ledger).not.toHaveBeenCalled();
  expect(mocks.sync).not.toHaveBeenCalled();
});

test.each(["other-tenant", "disabled", "unfinished"])("%s cannot activate qualified FRL processing", async (variant) => {
  if (variant === "other-tenant") mocks.assignment.mockResolvedValue({ accountId: "other", demoNumber: "+15555550101" });
  if (variant === "disabled") vi.stubEnv("RESPONSEOS_FRL_QUALIFIED_HANDOFF_ENABLED", "false");
  if (variant === "unfinished") mocks.normalize.mockResolvedValue({ finalized: false, callId: "synthetic-call" });
  const { POST } = await import("@/app/api/webhooks/telnyx/calls/route");
  await POST(request());
  await mocks.after.mock.calls[0][0]();
  expect(mocks.sync).not.toHaveBeenCalled();
});
