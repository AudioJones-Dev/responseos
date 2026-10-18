import { afterAll, afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { generateKeyPairSync, sign } from "node:crypto";
import { MockCrmProvider } from "@/lib/providers/crm";
import { deferredCallbacks } from "./deferredCallbacks";
vi.mock("next/server", async original => ({ ...await original<typeof import("next/server")>(), after: (task: () => unknown) => deferredCallbacks.push(task) }));
import { normalizeTelnyxEvent } from "@/lib/providers/telnyx/normalize";
import { backfillWebhookEvent, recordWebhookEvent } from "@/lib/data/webhookEvents";
import { db } from "@/lib/db/client";
import { disconnectTestDb, prisma, resetAndSeedTestDb } from "./setup";

const accountId = "org_responseos_demo";
const phone = "+15555550991";
const demoNumber = "+15555550199";
async function input(index: number, sameCall: boolean) {
  const event = { data: { id: `concurrency-${index}`, event_type: "call.conversation_insights.generated", payload: {
    call_control_id: sameCall ? "shared-call" : `call-${index}`, from: phone, to: demoNumber, summary: "Synthetic operator review required",
  } } };
  const recorded = await recordWebhookEvent({ account_id: accountId, provider: "telnyx", provider_event_id: event.data.id, event_type: event.data.event_type, raw_body: JSON.stringify(event), signature_valid: true });
  if (!recorded.ok) throw new Error("synthetic ledger failed");
  return { accountId, demoNumber, webhookEventId: recorded.data.id, event };
}

describe("cooperating Telnyx normalizers", () => {
  beforeEach(resetAndSeedTestDb);
  afterAll(disconnectTestDb);
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
  test("signed concurrent stale retries create one CRM operation and reject a tenant collision", async () => {
    const keys = generateKeyPairSync("ed25519");
    vi.stubEnv("TELNYX_PUBLIC_KEY", keys.publicKey.export({ type: "spki", format: "pem" }).toString());
    vi.stubEnv("RESPONSEOS_LIVE_TELNYX_INGEST_ENABLED", "true");
    vi.stubEnv("RESPONSEOS_LIVE_HUBSPOT_ENABLED", "false");
    vi.stubEnv("RESPONSEOS_DEMO_ACCOUNT_ID", accountId);
    vi.stubEnv("RESPONSEOS_DEMO_PHONE_E164", demoNumber);
    const value = { data: { id: "signed-concurrent", event_type: "call.conversation_insights.generated", occurred_at: new Date().toISOString(), payload: { call_control_id: "signed-shared", from: phone, to: demoNumber, summary: "Synthetic callback", qualification: { status: "qualified" }, next_action: "Synthetic callback" } } };
    const recorded = await recordWebhookEvent({ account_id: accountId, provider: "telnyx", provider_event_id: value.data.id, event_type: value.data.event_type, raw_body: JSON.stringify(value), signature_valid: true });
    if (!recorded.ok) throw new Error("Ledger required");
    await prisma.webhookEvent.update({ where: { id: recorded.data.id }, data: { received_at: new Date(0) } });
    const route = await import("@/app/api/webhooks/telnyx/calls/route");
    const request = () => {
      const body = JSON.stringify(value), timestamp = String(Math.floor(Date.now() / 1000));
      return new Request("http://localhost", { method: "POST", headers: { "content-type": "application/json", "telnyx-timestamp": timestamp, "telnyx-signature-ed25519": sign(null, Buffer.from(`${timestamp}|${body}`), keys.privateKey).toString("base64") }, body });
    };
    const create = vi.spyOn(MockCrmProvider.prototype, "createContact");
    deferredCallbacks.length = 0;
    const responses = await Promise.all([route.POST(request()), route.POST(request()), route.POST(request())]);
    expect(responses.map(response => response.status)).toEqual([200, 200, 200]);
    expect(deferredCallbacks).toHaveLength(3);
    await Promise.all(deferredCallbacks.splice(0).map(callback => callback()));
    const saved = await prisma.webhookEvent.findUniqueOrThrow({ where: { id: recorded.data.id } });
    expect(saved.process_status).toBe("processed");
    expect(await prisma.crmSyncOperation.count({ where: { account_id: accountId } })).toBe(1);
    expect(create).toHaveBeenCalledOnce();
    vi.stubEnv("RESPONSEOS_DEMO_ACCOUNT_ID", "org_mock_1");
    expect((await route.POST(request())).status).toBe(503);
    expect(deferredCallbacks).toHaveLength(0);
    expect(await prisma.webhookEvent.findUniqueOrThrow({ where: { id: recorded.data.id } })).toEqual(saved);
    expect(await prisma.call.count({ where: { account_id: "org_mock_1", provider_call_id: "signed-shared" } })).toBe(0);
  });
  test("concurrent tenant collisions and stale retry preserve the first ledger owner", async () => {
    const first = await input(90, true);
    await prisma.webhookEvent.update({ where: { id: first.webhookEventId }, data: { received_at: new Date(0) } });
    const results = await Promise.all(Array.from({ length: 6 }, (_, index) => recordWebhookEvent({ account_id: index % 2 ? "org_mock_1" : accountId, provider: "telnyx", provider_event_id: first.event.data.id, event_type: first.event.data.event_type, raw_body: JSON.stringify(first.event), signature_valid: true })));
    expect(results.filter(result => !result.ok)).toHaveLength(3);
    for (const result of results.filter(result => !result.ok)) expect(result).toMatchObject({ error: { code: "webhook_tenant_conflict" } });
    await Promise.all(results.filter(result => result.ok).map(() => normalizeTelnyxEvent(first)));
    expect(await prisma.contact.count({ where: { account_id: accountId, phone } })).toBe(1);
    expect(await prisma.call.count({ where: { account_id: accountId, provider_call_id: "shared-call" } })).toBe(1);
    expect(await prisma.call.count({ where: { account_id: "org_mock_1", provider_call_id: "shared-call" } })).toBe(0);
    const original = await prisma.webhookEvent.findUniqueOrThrow({ where: { id: first.webhookEventId } });
    await expect(backfillWebhookEvent({ id: original.id, account_id: "org_mock_1", raw_body: "foreign", payload_expires_at: null })).rejects.toThrow("webhook_tenant_conflict");
    expect(await prisma.webhookEvent.findUniqueOrThrow({ where: { id: original.id } })).toEqual(original);
  });
  test("simultaneous unscoped backfills bind once and never replace the winning tenant", async () => {
    const row = await recordWebhookEvent({ provider: "telnyx", provider_event_id: "unscoped-race", event_type: "call.initiated", raw_body: "{}", signature_valid: true });
    if (!row.ok) throw new Error("Ledger required");
    const results = await Promise.allSettled([accountId, "org_mock_1"].map(account_id => backfillWebhookEvent({ id: row.data.id, account_id, raw_body: JSON.stringify({ account_id }), payload_expires_at: null })));
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(result => result.status === "rejected")).toHaveLength(1);
    const saved = await prisma.webhookEvent.findUniqueOrThrow({ where: { id: row.data.id } });
    expect(JSON.parse(saved.raw_body).account_id).toBe(saved.account_id);
  });
  test.each([true, false])("concurrent same-phone normalizers preserve uniqueness (same call: %s)", async sameCall => {
    const inputs = await Promise.all(Array.from({ length: 6 }, (_, index) => input(index, sameCall)));
    await Promise.all(inputs.map(params => normalizeTelnyxEvent(params)));
    expect(await prisma.contact.count({ where: { account_id: accountId, phone } })).toBe(1);
    const calls = await prisma.call.findMany({ where: { account_id: accountId, from_number: phone } });
    expect(calls).toHaveLength(sameCall ? 1 : 6);
    expect(await prisma.leadEvent.count({ where: { call_id: { in: calls.map(call => call.id) } } })).toBe(calls.length);
  });
  test("supplied transaction rolls all canonical writes back without replay", async () => {
    const params = await input(0, true);
    const leadsBefore = await prisma.leadEvent.count({ where: { account_id: accountId } });
    if (!db) throw new Error("database required");
    await expect(db.$transaction(async client => {
      await normalizeTelnyxEvent({ ...params, client });
      throw new Error("synthetic rollback");
    })).rejects.toThrow("synthetic rollback");
    expect(await prisma.contact.count({ where: { account_id: accountId, phone } })).toBe(0);
    expect(await prisma.call.count({ where: { account_id: accountId, from_number: phone } })).toBe(0);
    expect(await prisma.leadEvent.count({ where: { account_id: accountId } })).toBe(leadsBefore);
    expect((await prisma.webhookEvent.findUniqueOrThrow({ where: { id: params.webhookEventId } })).process_status).toBe("received");
  });
});
