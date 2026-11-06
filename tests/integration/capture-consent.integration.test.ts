import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import { createCaptureSession, recordCaptureEvent } from "@/lib/communications/consent/store";
import { normalizeTelnyxEvent } from "@/lib/providers/telnyx/normalize";
import { recordWebhookEvent, computeDedupeHash } from "@/lib/data/webhookEvents";
import { runCrmSyncForCall } from "@/lib/crm/syncFinalizedCall";
import { MockCrmProvider } from "@/lib/providers/crm/mock";
import type { TelnyxWebhookEnvelope } from "@/lib/providers/telnyx/webhook";
import { prisma, resetAndSeedTestDb, disconnectTestDb, setDevSession } from "./setup";

const accountId = "org_responseos_demo", providerCallId = "synthetic-consent-call", callId = "synthetic-canonical-call";
const demoNumber = "+15555550100", secret = "UNAUTHORIZED_CONTENT_SENTINEL";
let base: number;
const at = (seconds: number) => new Date(base + seconds * 1000).toISOString();
function event(id = "content-event", payload: Record<string, unknown> = {}): TelnyxWebhookEnvelope {
  return { data: { id, event_type: "call.conversation.ended", occurred_at: at(60), payload: {
    call_control_id: providerCallId, call_leg_id: "caller-leg", participant_leg_ids: ["caller-leg", "founder-leg"],
    from: "+15555550101", to: demoNumber, start_time: at(10), end_time: at(50), transcript: secret, ...payload,
  } } };
}
async function ledger(e: TelnyxWebhookEnvelope, tenant = accountId, signature = true) {
  const result = await recordWebhookEvent({ account_id: tenant, provider: "telnyx", provider_event_id: e.data.id,
    event_type: e.data.event_type, raw_body: JSON.stringify(e), signature_valid: signature });
  if (!result.ok) throw new Error(result.error.code);
  return result.data.id;
}
async function ingest(e = event(), tenant = accountId) {
  return normalizeTelnyxEvent({ accountId: tenant, demoNumber, event: e, webhookEventId: await ledger(e, tenant) });
}
async function prepare(accept = true) {
  await createCaptureSession({ accountId, providerCallId, callId, disclosureVersion: "synthetic-v1", expiresAt: at(3600),
    participants: [{ legId: "caller-leg", role: "caller" }, { legId: "founder-leg", role: "founder" }] });
  if (accept) {
    for (const legId of ["caller-leg", "founder-leg"]) await recordCaptureEvent(accountId, providerCallId, {
      id: legId, kind: "decision", at: at(0), legId, choice: "accept",
    });
    await recordCaptureEvent(accountId, providerCallId, { id: "start-command-ack", kind: "start_ack", at: at(5) });
  }
}
async function assertNoContent() {
  expect(await prisma.call.findUnique({ where: { id: callId } })).toMatchObject({ transcript: null, summary: null, recording_url: null });
  expect(await prisma.callSegment.count({ where: { call_id: callId } })).toBe(0);
  expect(await prisma.callTranscript.count({ where: { call_id: callId } })).toBe(0);
  const rows = await prisma.webhookEvent.findMany();
  expect(JSON.stringify(rows)).not.toContain(secret);
  expect(JSON.stringify(await prisma.auditLog.findMany())).not.toContain(secret);
  expect(await prisma.crmSyncOperation.count()).toBe(0);
}

describe("consent before durable Telnyx content", () => {
  beforeEach(async () => {
    await resetAndSeedTestDb(); setDevSession("aj_admin"); base = Date.now() - 120000;
    await prisma.call.create({ data: { id: callId, account_id: accountId, provider: "telnyx", provider_call_id: providerCallId,
      direction: "inbound", status: "answered", from_number: "+15555550101", to_number: demoNumber, started_at: new Date(base) } });
  });
  afterAll(disconnectTestDb);

  test("signed content without durable consent cannot enter any content table or raw ledger", async () => {
    expect((await ingest()).callId).toBeNull(); await assertNoContent();
  });
  test("content disguised as event identifiers or unsupported event types is not retained", async () => {
    const e = event(secret); e.data.event_type = secret;
    await ingest(e); await assertNoContent();
  });
  test("an unsigned receipt cannot authorize normalization", async () => {
    await prepare(); const e = event();
    expect((await normalizeTelnyxEvent({ accountId, demoNumber, event: e, webhookEventId: await ledger(e, accountId, false) })).callId).toBeNull();
    await assertNoContent();
  });
  test("authorized transcript keeps tenant, canonical call, leg, consent revision and interval evidence", async () => {
    await prepare(); expect((await ingest()).callId).toBe(callId);
    const receipt = await prisma.webhookEvent.findFirstOrThrow({ where: { dedupe_hash: computeDedupeHash("telnyx", "content-event") } });
    expect(JSON.parse(receipt.raw_body)).toMatchObject({ call_id: callId, leg_id: "caller-leg", scope: "transcription", start: at(10), end: at(50), crm: "blocked", speaker_verified: false });
    expect(receipt.raw_body).not.toContain(secret);
    expect(await prisma.callTranscript.findUnique({ where: { call_id: callId } })).toMatchObject({ account_id: accountId, inline_text: secret });
    expect(await prisma.callSegment.count({ where: { call_id: callId } })).toBe(1);
  });
  test("decline still permits metadata-only routing and strips hidden content", async () => {
    await prepare(false);
    await recordCaptureEvent(accountId, providerCallId, { id: "decline", kind: "decision", at: at(0), legId: "caller-leg", choice: "decline" });
    await ingest();
    const routing = event("routing"); routing.data.event_type = "call.answered";
    expect((await ingest(routing)).callId).toBe(callId); await assertNoContent();
  });
  test.each(["revoke", "stop_failed", "provider_failure", "transfer_failed"] as const)("%s blocks late content, including an earlier interval", async kind => {
    await prepare();
    await recordCaptureEvent(accountId, providerCallId, kind === "revoke"
      ? { id: "stop", kind: "decision", at: at(55), legId: "founder-leg", choice: "revoke" }
      : { id: "stop", kind, at: at(55) });
    expect((await ingest()).callId).toBeNull(); await assertNoContent();
  });
  test.each([{ call_leg_id: "other-leg" }, { participant_leg_ids: ["caller-leg", "founder-leg", "new-leg"] }])("unexpected topology closes the call and cannot be restored by a later payload: %j", async payload => {
    await prepare(); await ingest(event("unknown-topology", payload)); await ingest(event("later-normal-payload")); await assertNoContent();
  });
  test("cross-tenant assignment cannot use another tenant's consent", async () => {
    await prepare(); expect((await ingest(event(), "org_mock_1")).callId).toBeNull(); await assertNoContent();
  });
  test("duplicate and concurrent webhook deliveries insert one segment", async () => {
    await prepare(); const e = event(); const webhookEventId = await ledger(e);
    const input = { accountId, demoNumber, event: e, webhookEventId };
    await Promise.all([normalizeTelnyxEvent(input), normalizeTelnyxEvent(input)]);
    expect(await ledger(e)).toBe(webhookEventId);
    expect(await prisma.callSegment.count({ where: { call_id: callId } })).toBe(1);
  });
  test("concurrent revocation serializes with writes and rejects every subsequent delivery", async () => {
    await prepare();
    await Promise.all([
      recordCaptureEvent(accountId, providerCallId, { id: "race-revoke", kind: "decision", at: at(55), legId: "caller-leg", choice: "revoke" }),
      ingest(),
    ]);
    const count = await prisma.callSegment.count({ where: { call_id: callId } });
    expect(count).toBeLessThanOrEqual(1);
    expect((await ingest(event("after-revoke"))).callId).toBeNull();
    expect(await prisma.callSegment.count({ where: { call_id: callId } })).toBe(count);
  });
  test("out-of-order authorized segments retain evidence in capture-time order", async () => {
    await prepare(); await ingest(event("later", { start_time: at(30), end_time: at(40), transcript: "Later" }));
    await ingest(event("earlier", { start_time: at(10), end_time: at(20), transcript: "Earlier" }));
    expect(await prisma.call.findUnique({ where: { id: callId } })).toMatchObject({ transcript: "Earlier\nLater", ended_at: new Date(at(40)) });
  });
  test("a receipt cannot authorize altered content or be replayed after missing-consent rejection", async () => {
    const e = event(); const webhookEventId = await ledger(e); await ingest(e); await prepare();
    expect((await normalizeTelnyxEvent({ accountId, demoNumber, event: e, webhookEventId })).callId).toBeNull();
    expect((await normalizeTelnyxEvent({ accountId, demoNumber, event: event("content-event", { transcript: "Changed" }), webhookEventId })).callId).toBeNull();
    await assertNoContent();
  });
  test("unauthorized CRM retry cannot contact a provider even for accepted transcript", async () => {
    await prepare(); await ingest(); const provider = new MockCrmProvider(); const lookup = vi.spyOn(provider, "findContacts");
    const result = await runCrmSyncForCall({ accountId, callId, providerOverride: provider });
    expect(result.ok && result.data.status).toBe("review_required"); expect(lookup).not.toHaveBeenCalled();
  });
  test("durable decisions deduplicate and tenant clients cannot author consent", async () => {
    await prepare(); const row = await prisma.callCaptureConsent.findFirstOrThrow();
    await recordCaptureEvent(accountId, providerCallId, { id: "start-command-ack", kind: "start_ack", at: at(5) });
    expect((await prisma.callCaptureConsent.findFirstOrThrow()).revision).toBe(row.revision);
    setDevSession("client_admin@org_mock_1");
    await expect(recordCaptureEvent(accountId, providerCallId, { id: "forged", kind: "start_ack", at: at(5) })).rejects.toThrow();
  });
});
