import { afterAll, afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { deliverQualifiedCallNotification, listQualifiedNotificationDeliveries } from "@/lib/notifications/qualifiedCallDelivery";
import { syncFinalizedCallAndPrepareHandoff } from "@/lib/crm/qualifiedCallHandoff";
import { db } from "@/lib/db/client";
import { MockCrmProvider } from "@/lib/providers/crm/mock";
import type { CrmProvider } from "@/lib/providers/crm/types";
import { EmailProviderError, type QualifiedEmailProvider } from "@/lib/providers/resend/types";
import { syntheticHandoffSnapshot } from "../fixtures/qualifiedHandoffPolicy";
import { disconnectTestDb, prisma, resetAndSeedTestDb } from "./setup";

const accountId = "org_responseos_demo";
const callId = "call_responseos_demo";
const messageId = "00000000-0000-4000-8000-000000000001";
let crm: CrmProvider;
let email: QualifiedEmailProvider;
const deliver = () => deliverQualifiedCallNotification({ accountId, callId, crmProviderOverride: crm, emailProviderOverride: email });
const record = () => prisma.qualifiedNotificationDelivery.findFirstOrThrow({ where: { account_id: accountId } });

describe("qualified email delivery using synthetic Postgres and providers only", () => {
  beforeEach(async () => {
    await resetAndSeedTestDb();
    vi.stubEnv("RESPONSEOS_FRL_HANDOFF_ACCOUNT_ID", accountId);
    vi.stubEnv("RESPONSEOS_FRL_QUALIFIED_HANDOFF_ENABLED", "true");
    vi.stubEnv("RESPONSEOS_FRL_NOTIFICATION_DELIVERY_ENABLED", "true");
    vi.stubEnv("RESPONSEOS_FRL_HANDOFF_SNAPSHOT_ID", "synthetic-snapshot");
    vi.stubEnv("RESPONSEOS_DEV_SESSION", "aj_admin");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("No real HTTP permitted in this suite")));
    const snapshot = syntheticHandoffSnapshot(accountId);
    await prisma.businessMemorySnapshot.create({ data: {
      ...snapshot, memory_json: JSON.parse(JSON.stringify(snapshot.memory_json)),
      schema_version: "prospect-bootstrap.v1", version: 1, template_version: "synthetic-test",
    } });
    crm = new MockCrmProvider();
    Object.defineProperty(crm, "providerId", { value: "hubspot" });
    crm.getFollowUpTaskOwner = vi.fn().mockResolvedValue("12345");
    email = {
      providerId: "resend",
      send: vi.fn().mockResolvedValue({ messageId, event: "accepted" }),
      inspect: vi.fn().mockResolvedValue({ messageId, event: "delivered" }),
    };
    const prepared = await syncFinalizedCallAndPrepareHandoff({ accountId, callId, providerOverride: crm });
    expect(prepared).toMatchObject({ ok: true, data: { handoff: { status: "queued" } } });
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  afterAll(disconnectTestDb);

  test("one qualified interaction has one send, distinct acceptance/delivery, and traced owner evidence", async () => {
    expect(await deliver()).toMatchObject({ ok: true, data: { status: "accepted", providerMessageId: messageId, deliveryObservedAt: null, attemptCount: 1 } });
    const handoff = await prisma.qualifiedCallHandoff.findFirstOrThrow({ where: { account_id: accountId } });
    const sent = await record();
    expect(sent).toMatchObject({ call_id: callId, handoff_id: handoff.id, notification_id: handoff.notification_id, provider_task_id: handoff.provider_task_id, verified_owner_id: "12345" });
    expect(sent.owner_verified_at).toBeInstanceOf(Date);
    expect(sent.accepted_at).toBeInstanceOf(Date);
    expect(await deliver()).toMatchObject({ ok: true, data: { status: "delivered", attemptCount: 1 } });
    expect((await record()).delivery_observed_at).toBeInstanceOf(Date);
    expect(await deliver()).toMatchObject({ ok: true, data: { status: "delivered" } });
    expect(email.send).toHaveBeenCalledOnce();
    expect(email.inspect).toHaveBeenCalledOnce();
    expect(await prisma.qualifiedNotificationDelivery.count()).toBe(1);
  });

  test("real database claims serialize concurrent workers", async () => {
    await Promise.all([deliver(), deliver(), deliver()]);
    expect(email.send).toHaveBeenCalledOnce();
    expect(await prisma.qualifiedNotificationDelivery.count()).toBe(1);
    expect((await record()).attempt_count).toBe(1);
  });

  test("a later revoked policy cannot erase observed terminal delivery evidence", async () => {
    await deliver();
    await deliver();
    await prisma.businessMemorySnapshot.update({ where: { id: "synthetic-snapshot", account_id: accountId }, data: { revoked_at: new Date() } });
    expect(await deliver()).toMatchObject({ ok: true, data: { status: "delivered", providerMessageId: messageId } });
    expect(email.send).toHaveBeenCalledOnce();
    expect(email.inspect).toHaveBeenCalledOnce();
  });

  test.each(["maybe", "unqualified", "spam"] as const)("reclassification to %s suppresses an already queued alert", async (status) => {
    const handoff = await prisma.qualifiedCallHandoff.findFirstOrThrow();
    await prisma.leadQualification.update({ where: { lead_event_id: handoff.lead_event_id }, data: { qualification_status: status } });
    expect(await deliver()).toMatchObject({ ok: true, data: { status: "review_required", errorCode: "qualification_no_longer_eligible" } });
    expect(email.send).not.toHaveBeenCalled();
  });

  test("incomplete classification never sends a queued alert", async () => {
    const handoff = await prisma.qualifiedCallHandoff.findFirstOrThrow();
    await prisma.leadQualification.delete({ where: { lead_event_id: handoff.lead_event_id } });
    expect(await deliver()).toMatchObject({ ok: true, data: { status: "review_required" } });
    expect(email.send).not.toHaveBeenCalled();
  });

  test("revoked approval stops before network and retains outbox", async () => {
    await prisma.businessMemorySnapshot.update({ where: { id: "synthetic-snapshot", account_id: accountId }, data: { revoked_at: new Date() } });
    expect(await deliver()).toMatchObject({ ok: true, data: { status: "review_required", errorCode: "approved_delivery_configuration_required" } });
    expect(email.send).not.toHaveBeenCalled();
    expect(await prisma.notification.findFirst({ where: { dedupe_key: { not: null } } })).toMatchObject({ status: "queued", sent_at: null });
  });

  test("changed queued recipient cannot override approved destination", async () => {
    await prisma.notification.updateMany({ where: { account_id: accountId, dedupe_key: { not: null } }, data: { recipient: "wrong@example.com" } });
    expect(await deliver()).toMatchObject({ ok: true, data: { status: "review_required", errorCode: "approved_email_recipient_required" } });
    expect(email.send).not.toHaveBeenCalled();
  });

  test("owner readback mismatch produces no email", async () => {
    vi.mocked(crm.getFollowUpTaskOwner!).mockResolvedValue("54321");
    expect(await deliver()).toMatchObject({ ok: true, data: { status: "review_required", errorCode: "delivery_owner_mismatch", attemptCount: 0 } });
    expect(email.send).not.toHaveBeenCalled();
  });

  test("policy revoked during owner readback is checked again immediately before send", async () => {
    vi.mocked(crm.getFollowUpTaskOwner!).mockImplementation(async () => {
      await prisma.businessMemorySnapshot.update({ where: { id: "synthetic-snapshot", account_id: accountId }, data: { revoked_at: new Date() } });
      return "12345";
    });
    expect(await deliver()).toMatchObject({ ok: true, data: { status: "review_required", errorCode: "delivery_authority_changed" } });
    expect(email.send).not.toHaveBeenCalled();
  });

  test("real email transport cannot consume mock CRM evidence", async () => {
    await prisma.qualifiedCallHandoff.updateMany({ data: { provider: "mock" } });
    expect(await deliver()).toMatchObject({ ok: true, data: { status: "review_required", errorCode: "verified_live_crm_capture_required" } });
    expect(email.send).not.toHaveBeenCalled();
  });

  test("missing contact/activity capture stops notification", async () => {
    await prisma.crmSyncOperation.updateMany({ data: { provider_activity_id: null } });
    expect(await deliver()).toMatchObject({ ok: true, data: { status: "review_required", errorCode: "verified_live_crm_capture_required" } });
    expect(email.send).not.toHaveBeenCalled();
  });

  test("tenant mismatch and foreign call/notification references cause no send", async () => {
    expect(await deliverQualifiedCallNotification({ accountId: "foreign", callId, emailProviderOverride: email, crmProviderOverride: crm })).toEqual({ ok: true, data: null });
    await prisma.notification.updateMany({ where: { dedupe_key: { not: null } }, data: { account_id: "foreign" } });
    expect(await deliver()).toMatchObject({ ok: false, error: { code: "qualified_outbox_reference_invalid" } });
    expect(email.send).not.toHaveBeenCalled();
    expect(await prisma.qualifiedNotificationDelivery.count()).toBe(0);
  });

  test("ambiguous provider success retries with the same key and one simulated human-facing email", async () => {
    const accepted = new Set<string>();
    vi.mocked(email.send).mockImplementationOnce(async (request) => {
      accepted.add(request.idempotencyKey);
      throw new EmailProviderError("resend_transport_unknown", true);
    }).mockImplementation(async (request) => {
      accepted.add(request.idempotencyKey);
      return { messageId, event: "accepted" };
    });
    expect(await deliver()).toMatchObject({ ok: true, data: { status: "retryable_failed" } });
    expect(await deliver()).toMatchObject({ ok: true, data: { status: "accepted", attemptCount: 2 } });
    const requests = vi.mocked(email.send).mock.calls;
    expect(requests[0][0]).toEqual(requests[1][0]);
    expect(accepted.size).toBe(1);
  });

  test("failure after provider success reuses key rather than creating another message", async () => {
    const commit = vi.spyOn(db!, "$transaction").mockRejectedValueOnce(new Error("Synthetic local commit failure"));
    expect(await deliver()).toMatchObject({ ok: true, data: { status: "retryable_failed", errorCode: "qualified_delivery_unknown" } });
    commit.mockRestore();
    expect(await deliver()).toMatchObject({ ok: true, data: { status: "accepted" } });
    const requests = vi.mocked(email.send).mock.calls;
    expect(requests[0][0].idempotencyKey).toBe(requests[1][0].idempotencyKey);
  });

  test("expired uncertain retry window requires reconciliation, never another send", async () => {
    vi.mocked(email.send).mockRejectedValue(new EmailProviderError("resend_transport_unknown", true));
    await deliver();
    await prisma.qualifiedNotificationDelivery.updateMany({ data: { first_attempt_at: new Date(Date.now() - 23 * 60 * 60 * 1000) } });
    expect(await deliver()).toMatchObject({ ok: true, data: { status: "review_required", errorCode: "provider_reconciliation_required" } });
    expect(email.send).toHaveBeenCalledOnce();
  });

  test("active lease blocks retry; expired lease safely reuses original send identity", async () => {
    vi.mocked(email.send).mockRejectedValueOnce(new EmailProviderError("resend_transport_unknown", true));
    await deliver();
    await prisma.qualifiedNotificationDelivery.updateMany({ data: { status: "processing", claim_token: "synthetic-lost-worker", lease_expires_at: new Date(Date.now() + 120_000) } });
    expect(await deliver()).toMatchObject({ ok: true, data: { status: "processing" } });
    expect(email.send).toHaveBeenCalledOnce();
    await prisma.qualifiedNotificationDelivery.updateMany({ data: { lease_expires_at: new Date(Date.now() - 1000) } });
    expect(await deliver()).toMatchObject({ ok: true, data: { status: "accepted" } });
    expect(email.send).toHaveBeenCalledTimes(2);
    expect(vi.mocked(email.send).mock.calls[0][0]).toEqual(vi.mocked(email.send).mock.calls[1][0]);
  });

  test("mutated payload cannot reuse a provider key", async () => {
    vi.mocked(email.send).mockRejectedValueOnce(new EmailProviderError("resend_transport_unknown", true));
    await deliver();
    await prisma.notification.updateMany({ where: { dedupe_key: { not: null } }, data: { message: "Mutated synthetic call" } });
    expect(await deliver()).toMatchObject({ ok: true, data: { status: "review_required", errorCode: "delivery_payload_changed" } });
    expect(email.send).toHaveBeenCalledOnce();
  });

  test("poll failures cannot trigger another POST after provider ID is retained", async () => {
    await deliver();
    vi.mocked(email.inspect).mockRejectedValueOnce(new EmailProviderError("resend_http_503", true));
    expect(await deliver()).toMatchObject({ ok: true, data: { status: "retryable_failed", providerMessageId: messageId } });
    expect(await deliver()).toMatchObject({ ok: true, data: { status: "delivered" } });
    expect(email.send).toHaveBeenCalledOnce();
  });

  test("bounce is retained as failed and cannot be retried as a second email", async () => {
    await deliver();
    vi.mocked(email.inspect).mockResolvedValue({ messageId, event: "bounced" });
    expect(await deliver()).toMatchObject({ ok: true, data: { status: "failed", errorCode: "resend_bounced" } });
    await deliver();
    expect(email.send).toHaveBeenCalledOnce();
    expect(await prisma.notification.findFirst({ where: { dedupe_key: { not: null } } })).toMatchObject({ status: "failed" });
  });

  test("status inspection exposes correlation/evidence without recipient, message or owner ID", async () => {
    await deliver();
    const result = await listQualifiedNotificationDeliveries();
    expect(result).toMatchObject({ ok: true, data: [{ callId, status: "accepted", providerMessageId: messageId }] });
    expect(JSON.stringify(result)).not.toContain("owner@example.com");
    expect(JSON.stringify(result)).not.toContain("verified_owner_id");
    expect(JSON.stringify(result)).not.toContain("Callback:");
  });
});
