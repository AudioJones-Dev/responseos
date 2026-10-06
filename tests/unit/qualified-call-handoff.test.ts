import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { runQualifiedCallHandoff, listQualifiedCallHandoffs, retryQualifiedCallHandoff } from "@/lib/crm/qualifiedCallHandoff";
import { resolveQualifiedHandoffPolicy } from "@/lib/crm/qualifiedHandoffPolicy";
import { MockCrmProvider } from "@/lib/providers/crm/mock";
import { HubSpotCrmProvider } from "@/lib/providers/crm/hubspot";
import { syntheticHandoffSnapshot, syntheticHandoffPolicy } from "../fixtures/qualifiedHandoffPolicy";
import { contentHash } from "@/lib/prospectBootstrap/memory";

const mocks = vi.hoisted(() => ({
  db: {
    call: { findFirst: vi.fn() }, contact: { findFirst: vi.fn() },
    leadEvent: { findFirst: vi.fn() }, leadQualification: { findUnique: vi.fn() },
    crmSyncOperation: { findFirst: vi.fn() }, businessMemorySnapshot: { findFirst: vi.fn() },
    qualifiedCallHandoff: { upsert: vi.fn(), updateMany: vi.fn(), update: vi.fn(), findFirstOrThrow: vi.fn(), findMany: vi.fn() },
    notification: { upsert: vi.fn() }, $transaction: vi.fn(),
  }, requireRole: vi.fn(),
}));
vi.mock("@/lib/db/client", () => ({ db: mocks.db }));
vi.mock("@/lib/auth/session", () => ({ requireRole: mocks.requireRole }));

let row: Record<string, unknown>;
let provider: MockCrmProvider;
const params = () => ({ accountId: "synthetic-tenant", callId: "synthetic-call", providerOverride: provider });

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("RESPONSEOS_FRL_QUALIFIED_HANDOFF_ENABLED", "true");
  vi.stubEnv("RESPONSEOS_FRL_HANDOFF_ACCOUNT_ID", "synthetic-tenant");
  vi.stubEnv("RESPONSEOS_FRL_HANDOFF_SNAPSHOT_ID", "synthetic-snapshot");
  provider = new MockCrmProvider();
  row = { id: "handoff", account_id: "synthetic-tenant", call_id: "synthetic-call",
    operation_key: "qualified-call:synthetic-tenant:synthetic-call", status: "pending", provider: "mock",
    attempt_count: 0, provider_task_id: null, notification_id: null,
    config_hash: null, config_snapshot_id: null, last_error_code: null, created_at: new Date("2026-10-06T12:00:00Z") };
  mocks.db.call.findFirst.mockResolvedValue({ id: "synthetic-call", contact_id: "synthetic-contact", account_id: "synthetic-tenant",
    status: "completed", direction: "inbound", from_number: "+15555550101", started_at: new Date("2026-10-06T12:00:00Z"), summary: "Needs ramp review." });
  mocks.db.contact.findFirst.mockResolvedValue({ id: "synthetic-contact", phone: "+15555550101",
    first_name: "Synthetic", last_name: "Caller", city: "Synthetic city", email: "caller@example.com", email_verified: false });
  mocks.db.leadEvent.findFirst.mockResolvedValue({ id: "synthetic-lead", source: "phone", notes: "Call back to discuss ramp assessment." });
  mocks.db.leadQualification.findUnique.mockResolvedValue({ qualification_status: "qualified",
    service_needed: "ramp", service_area_match: true, timeline: "this_week", property_type: "home" });
  mocks.db.crmSyncOperation.findFirst.mockResolvedValue({ provider: "mock", provider_contact_id: "mock-contact",
    provider_activity_id: "mock-activity", status: "succeeded" });
  mocks.db.businessMemorySnapshot.findFirst.mockResolvedValue(syntheticHandoffSnapshot("synthetic-tenant"));
  mocks.db.qualifiedCallHandoff.upsert.mockImplementation(async () => ({ ...row }));
  mocks.db.qualifiedCallHandoff.updateMany.mockImplementation(async ({ where, data }) => {
    if (where.account_id !== row.account_id || !where.status.in.includes(row.status)) return { count: 0 };
    row = { ...row, ...data, attempt_count: Number(row.attempt_count) + 1 };
    return { count: 1 };
  });
  mocks.db.qualifiedCallHandoff.findFirstOrThrow.mockImplementation(async ({ where }) => {
    if (where.account_id !== row.account_id) throw new Error("not_found");
    return { ...row };
  });
  mocks.db.qualifiedCallHandoff.update.mockImplementation(async ({ where, data }) => {
    if (where.account_id !== row.account_id) throw new Error("not_found");
    row = { ...row, ...data }; return { ...row };
  });
  mocks.db.notification.upsert.mockResolvedValue({ id: "queued-notification", status: "queued", sent_at: null });
  mocks.db.$transaction.mockImplementation(async (fn) => fn(mocks.db));
});
afterEach(() => vi.unstubAllEnvs());

test("disabled and other-tenant paths perform no database or provider work", async () => {
  vi.stubEnv("RESPONSEOS_FRL_QUALIFIED_HANDOFF_ENABLED", "false");
  expect(await runQualifiedCallHandoff(params())).toEqual({ ok: true, data: null });
  vi.stubEnv("RESPONSEOS_FRL_QUALIFIED_HANDOFF_ENABLED", "true");
  expect(await runQualifiedCallHandoff({ ...params(), accountId: "other-tenant" })).toEqual({ ok: true, data: null });
  expect(mocks.db.call.findFirst).not.toHaveBeenCalled();
});

test.each(["maybe", "unqualified", "spam", null])("%s never creates an owner task or notification", async (status) => {
  mocks.db.leadQualification.findUnique.mockResolvedValue(status ? { qualification_status: status } : null);
  const task = vi.spyOn(provider, "createFollowUpTask");
  expect(await runQualifiedCallHandoff(params())).toEqual({ ok: true, data: null });
  expect(task).not.toHaveBeenCalled();
  expect(mocks.db.notification.upsert).not.toHaveBeenCalled();
  expect(mocks.db.qualifiedCallHandoff.upsert).not.toHaveBeenCalled();
});

test.each(["answered", "initiated"])("unfinished %s call cannot hand off", async (status) => {
  mocks.db.call.findFirst.mockResolvedValue({ id: "synthetic-call", status, direction: "inbound" });
  expect(await runQualifiedCallHandoff(params())).toEqual({ ok: true, data: null });
  expect(mocks.db.leadEvent.findFirst).not.toHaveBeenCalled();
});

test("CRM capture must finish before any handoff", async () => {
  mocks.db.crmSyncOperation.findFirst.mockResolvedValue(null);
  const result = await runQualifiedCallHandoff(params());
  expect(result).toMatchObject({ ok: false, error: { code: "crm_capture_pending" } });
  expect(mocks.db.qualifiedCallHandoff.upsert).not.toHaveBeenCalled();
});

test("qualified caller gets an owned task plus detailed, explicitly unsent notification", async () => {
  const task = vi.spyOn(provider, "createFollowUpTask");
  const result = await runQualifiedCallHandoff(params());
  expect(result).toMatchObject({ ok: true, data: { status: "queued", provider: "mock", deliveryStatus: "not_verified" } });
  expect(task).toHaveBeenCalledWith(expect.objectContaining({ ownerId: "12345", dueAt: "2026-10-06T12:00:00.000Z" }));
  const { create, where } = mocks.db.notification.upsert.mock.calls[0][0];
  expect(where).toEqual({ dedupe_key: row.operation_key, account_id: "synthetic-tenant" });
  expect(create).toMatchObject({ account_id: "synthetic-tenant", recipient: "owner@example.com", channel: "email" });
  expect(create.message).toContain("Callback: +15555550101");
  expect(create.message).toContain("Service: ramp");
  expect(create.message).toContain("Location: Synthetic city");
  expect(create.message).toContain("Call back to discuss ramp assessment");
  expect(create.message).not.toContain("caller@example.com");
  expect(create).not.toHaveProperty("sent_at");
});

test("concurrent and sequential retries create only one task and one outbox entry", async () => {
  const task = vi.spyOn(provider, "createFollowUpTask");
  await Promise.all([runQualifiedCallHandoff(params()), runQualifiedCallHandoff(params())]);
  await runQualifiedCallHandoff(params());
  expect(task).toHaveBeenCalledOnce();
  expect(mocks.db.notification.upsert).toHaveBeenCalledOnce();
  expect(row.attempt_count).toBe(1);
});

test("outbox failure retries using persisted task without duplicating it", async () => {
  const task = vi.spyOn(provider, "createFollowUpTask");
  mocks.db.$transaction.mockRejectedValueOnce(new Error("database failure with private details"));
  await runQualifiedCallHandoff(params());
  expect(row.status).toBe("retryable_failed");
  expect(row.last_error_code).toBe("qualified_handoff_failed");
  await runQualifiedCallHandoff(params());
  expect(row.status).toBe("queued");
  expect(task).toHaveBeenCalledOnce();
});

test("missing approved config waits for review with no task or notification", async () => {
  mocks.db.businessMemorySnapshot.findFirst.mockResolvedValue(null);
  const task = vi.spyOn(provider, "createFollowUpTask");
  const result = await runQualifiedCallHandoff(params());
  expect(result).toMatchObject({ ok: true, data: { status: "review_required", errorCode: "approved_handoff_configuration_required" } });
  expect(task).not.toHaveBeenCalled();
  expect(mocks.db.notification.upsert).not.toHaveBeenCalled();
  mocks.db.businessMemorySnapshot.findFirst.mockResolvedValue(syntheticHandoffSnapshot("synthetic-tenant"));
  await runQualifiedCallHandoff(params());
  expect(row.status).toBe("queued");
});

test("config changes during a partial handoff require review", async () => {
  row.config_hash = "old-hash";
  row.config_snapshot_id = "old-snapshot";
  const result = await runQualifiedCallHandoff(params());
  expect(result).toMatchObject({ ok: true, data: { errorCode: "handoff_configuration_changed" } });
  expect(mocks.db.notification.upsert).not.toHaveBeenCalled();
});

test("a failed contender cannot overwrite another tenant or worker", async () => {
  mocks.db.qualifiedCallHandoff.updateMany.mockRejectedValueOnce(new Error("claim failure"));
  expect(await runQualifiedCallHandoff(params())).toMatchObject({ ok: false });
  expect(mocks.db.qualifiedCallHandoff.update).not.toHaveBeenCalled();
  mocks.db.qualifiedCallHandoff.upsert.mockImplementationOnce(async () => { const snapshot = { ...row }; row.account_id = "other"; return snapshot; });
  expect(await runQualifiedCallHandoff(params())).toMatchObject({ ok: false });
  expect(mocks.db.qualifiedCallHandoff.update).not.toHaveBeenCalled();
});

test("live CRM objects cannot be handed off through a mock adapter", async () => {
  row.provider = "hubspot";
  mocks.db.crmSyncOperation.findFirst.mockResolvedValue({ provider: "hubspot", provider_contact_id: "1", provider_activity_id: "2" });
  expect(await runQualifiedCallHandoff(params())).toMatchObject({ ok: true, data: { errorCode: "crm_provider_mismatch" } });
  expect(mocks.db.notification.upsert).not.toHaveBeenCalled();
});

test.each(["12345", "99999", null])("owner readback %s gates the notification after task creation", async (ownerId) => {
  row.provider = "hubspot";
  mocks.db.crmSyncOperation.findFirst.mockResolvedValue({ provider: "hubspot", provider_contact_id: "1", provider_activity_id: "2" });
  const live = new HubSpotCrmProvider("synthetic-token");
  vi.spyOn(live, "findFollowUpTask").mockResolvedValue(null);
  vi.spyOn(live, "createFollowUpTask").mockResolvedValue({ providerTaskId: "synthetic-task" });
  vi.spyOn(live, "getFollowUpTaskOwner").mockResolvedValue(ownerId);
  vi.spyOn(live, "associateContact").mockResolvedValue(undefined);
  const result = await runQualifiedCallHandoff({ ...params(), providerOverride: live });
  if (ownerId === "12345") {
    expect(result).toMatchObject({ ok: true, data: { status: "queued" } });
    expect(mocks.db.notification.upsert).toHaveBeenCalledOnce();
  } else {
    expect(result).toMatchObject({ ok: true, data: { status: "review_required", errorCode: "handoff_owner_mismatch" } });
    expect(mocks.db.notification.upsert).not.toHaveBeenCalled();
  }
});

test.each(["bad-hash", "wrong-tenant", "conflicting", "invalid-owner", "invalid-recipient", "unsafe-link", "duplicate-policy", "no-approval"])(
  "policy rejects %s", async (variant) => {
    const snapshot = syntheticHandoffSnapshot("synthetic-tenant");
    const policy = { ...syntheticHandoffPolicy };
    if (variant === "wrong-tenant") snapshot.memory_json.accountId = "other";
    if (variant === "conflicting") snapshot.memory_json.conflicts.push("Unresolved notification owner");
    if (variant === "invalid-owner") policy.crmOwnerId = "Michael";
    if (variant === "invalid-recipient") policy.notification = { channel: "email", recipient: "unknown" };
    if (variant === "unsafe-link") policy.crmContactBaseUrl = "https://example.com/private/";
    if (variant === "duplicate-policy") snapshot.memory_json.policies.push(snapshot.memory_json.policies[0]);
    if (variant === "no-approval") snapshot.approved_by = "";
    snapshot.memory_json.policies[0].value = policy;
    snapshot.content_hash = variant === "bad-hash" ? "bad" : contentHash(snapshot.memory_json);
    mocks.db.businessMemorySnapshot.findFirst.mockResolvedValue(snapshot);
    expect(await resolveQualifiedHandoffPolicy("synthetic-tenant")).toBeNull();
    expect(mocks.db.businessMemorySnapshot.findFirst).toHaveBeenCalledWith({ where: {
      id: "synthetic-snapshot", account_id: "synthetic-tenant", status: "approved", revoked_at: null,
    } });
  },
);

test("operator role and tenant filter protect status and retry", async () => {
  mocks.requireRole.mockRejectedValueOnce(Object.assign(new Error("denied"), { code: "role_denied" }));
  expect(await listQualifiedCallHandoffs("synthetic-tenant")).toMatchObject({ ok: false, error: { code: "role_denied" } });
  expect(mocks.db.qualifiedCallHandoff.findMany).not.toHaveBeenCalled();
  mocks.requireRole.mockRejectedValueOnce(Object.assign(new Error("denied"), { code: "role_denied" }));
  expect(await retryQualifiedCallHandoff("synthetic-call")).toMatchObject({ ok: false });
  expect(mocks.db.call.findFirst).not.toHaveBeenCalled();
  mocks.db.qualifiedCallHandoff.findMany.mockResolvedValue([]);
  await listQualifiedCallHandoffs("synthetic-tenant");
  expect(mocks.db.qualifiedCallHandoff.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { account_id: "synthetic-tenant" } }));
});
