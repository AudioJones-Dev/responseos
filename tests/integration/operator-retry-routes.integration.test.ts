import { afterAll, afterEach, beforeEach, expect, test, vi } from "vitest";
import { MockCrmProvider } from "@/lib/providers/crm";
import * as emailProviders from "@/lib/providers/email";
import { deferredCallbacks } from "./deferredCallbacks";
import { disconnectTestDb, prisma, resetAndSeedTestDb, setDevSession } from "./setup";
const effects = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("next/server", async original => ({ ...await original<typeof import("next/server")>(), after: (callback: () => unknown) => deferredCallbacks.push(callback) }));
const accountId = "org_responseos_demo", callId = "call_responseos_demo";
let operationId: string, notificationId: string;
const writes = () => ["createContact", "createCallActivity", "createFollowUpTask", "associateContact"] as const;
beforeEach(async () => {
  await resetAndSeedTestDb(); setDevSession("operator");
  process.env.RESPONSEOS_DEMO_ACCOUNT_ID = accountId;
  deferredCallbacks.length = 0;
  effects.send.mockReset().mockResolvedValue({ providerMessageId: "synthetic-message" });
  vi.spyOn(emailProviders, "getEmailProvider").mockReturnValue({ providerId: "mock", send: effects.send });
  operationId = (await prisma.crmSyncOperation.create({ data: { account_id: accountId, call_id: callId, operation_key: `crm-call:${accountId}:${callId}`, provider: "mock", status: "retryable_failed", last_error_code: "crm_ready:contact_create" } })).id;
  notificationId = (await prisma.notification.create({ data: { account_id: accountId, call_id: callId, channel: "email", event: "completed_interaction", recipient: "synthetic@example.test", subject: "Synthetic", message: "Synthetic content", status: "failed", provider: "mock", dedupe_key: `completed_interaction:${accountId}:${callId}` } })).id;
});
afterEach(() => vi.restoreAllMocks());
afterAll(disconnectTestDb);
const request = () => new Request("http://localhost?accountId=org_mock_1", { method: "POST", body: JSON.stringify({ accountId: "org_mock_1" }) });

test.each([null, "client_admin@org_mock_1", "client_viewer@org_mock_1"])("retry/list routes deny %s without callback or final effects", async role => {
  const crm = await import("@/app/api/admin/crm-sync-operations/[id]/retry/route");
  const list = await import("@/app/api/admin/crm-sync-operations/route");
  const email = await import("@/app/api/admin/notifications/[id]/retry/route");
  const spies = writes().map(name => vi.spyOn(MockCrmProvider.prototype, name));
  const previous = process.env.RESPONSEOS_REQUIRE_AUTH;
  try {
    if (role) setDevSession(role); else { delete process.env.RESPONSEOS_DEV_SESSION; process.env.RESPONSEOS_REQUIRE_AUTH = "true"; }
    expect((await list.GET(new Request("http://localhost?accountId=org_mock_1"))).status).toBe(403);
    for (const id of [operationId, "missing-operation"]) expect((await crm.POST(request(), { params: Promise.resolve({ id }) })).status).toBe(403);
    for (const id of [notificationId, "missing-notification"]) expect((await email.POST(request(), { params: Promise.resolve({ id }) })).status).toBe(403);
    expect(deferredCallbacks).toHaveLength(0);
    expect(effects.send).not.toHaveBeenCalled();
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    expect(await prisma.crmSyncOperation.findUnique({ where: { id: operationId } })).toMatchObject({ status: "retryable_failed", attempt_count: 0 });
  } finally { if (previous === undefined) delete process.env.RESPONSEOS_REQUIRE_AUTH; else process.env.RESPONSEOS_REQUIRE_AUTH = previous; }
});

test.each(["operator", "aj_admin"])("%s retries reach synthetic final sinks and ignore client tenant overrides", async role => {
  setDevSession(role);
  const crm = await import("@/app/api/admin/crm-sync-operations/[id]/retry/route");
  const list = await import("@/app/api/admin/crm-sync-operations/route");
  const email = await import("@/app/api/admin/notifications/[id]/retry/route");
  const spies = writes().map(name => vi.spyOn(MockCrmProvider.prototype, name));
  const foreign = await prisma.crmSyncOperation.create({ data: { account_id: "org_mock_1", call_id: "foreign-call", operation_key: "foreign-operation", provider: "mock", status: "retryable_failed" } });
  const listing = await list.GET(new Request("http://localhost?accountId=org_mock_1"));
  expect(listing.status).toBe(200);
  const body = await listing.json();
  expect(JSON.stringify(body)).toContain(operationId);
  expect(JSON.stringify(body)).not.toContain(foreign.id);
  expect((await crm.POST(request(), { params: Promise.resolve({ id: foreign.id }) })).status).toBe(404);
  expect((await crm.POST(request(), { params: Promise.resolve({ id: operationId }) })).status).toBe(202);
  expect(deferredCallbacks).toHaveLength(1);
  await deferredCallbacks[0]();
  expect(await prisma.crmSyncOperation.findUnique({ where: { id: operationId } })).toMatchObject({ account_id: accountId, status: "succeeded" });
  expect(spies[0]).toHaveBeenCalledOnce(); expect(spies[1]).toHaveBeenCalledOnce(); expect(spies[2]).toHaveBeenCalledOnce();
  expect((await email.POST(request(), { params: Promise.resolve({ id: notificationId }) })).status).toBe(200);
  expect(effects.send).toHaveBeenCalledOnce();
  expect(await prisma.notification.findUnique({ where: { id: notificationId } })).toMatchObject({ account_id: accountId, status: "sent", provider_message_id: "synthetic-message" });
  expect(await prisma.crmSyncOperation.findUnique({ where: { id: foreign.id } })).toMatchObject({ status: "retryable_failed", attempt_count: 0 });
});
