import { beforeEach, expect, test, vi } from "vitest";
import { runCrmSyncForCall } from "@/lib/crm/syncFinalizedCall";
import { MockCrmProvider } from "@/lib/providers/crm/mock";

const database = vi.hoisted(() => ({
  crmSyncOperation: { findUnique: vi.fn(), upsert: vi.fn(), updateMany: vi.fn(), update: vi.fn(), findUniqueOrThrow: vi.fn() },
  call: { findFirst: vi.fn() },
  contact: { findFirst: vi.fn() },
  leadEvent: { findFirst: vi.fn() },
  leadQualification: { findUnique: vi.fn() },
  quoteRequest: { findUnique: vi.fn() },
}));
vi.mock("@/lib/db/client", () => ({ db: database }));
vi.mock("@/lib/auth/session", () => ({ requireRole: vi.fn() }));

let row: Record<string, unknown>;
beforeEach(() => {
  vi.resetAllMocks();
  row = {
    id: "op", account_id: "account", operation_key: "crm-call:account:call", provider: "mock",
    call_id: "call", status: "retryable_failed", attempt_count: 0,
    created_at: new Date(), updated_at: new Date(),
  };
  database.crmSyncOperation.findUnique.mockImplementation(async () => ({ ...row }));
  database.crmSyncOperation.upsert.mockImplementation(async () => ({ ...row, updated_at: new Date() }));
  database.crmSyncOperation.updateMany.mockImplementation(async ({ where, data }) => {
    if (where.account_id && where.account_id !== row.account_id) return { count: 0 };
    if (where.OR) {
      // The claim: pending/retryable, or processing past the TTL.
      const claimable = where.OR.some((clause: { status: string | { in: string[] }; updated_at?: { lte: Date } }) =>
        typeof clause.status === "string"
          ? clause.status === row.status && (row.updated_at as Date) <= clause.updated_at!.lte
          : clause.status.in.includes(row.status as string));
      if (!claimable) return { count: 0 };
      row = { ...row, ...data, attempt_count: Number(row.attempt_count) + 1, updated_at: new Date() };
      return { count: 1 };
    }
    // Generation-fenced writes: the ownership check before provider effects,
    // every operation state write, and the failure release.
    if (where.status && where.status !== row.status) return { count: 0 };
    if (where.attempt_count !== undefined && where.attempt_count !== row.attempt_count) return { count: 0 };
    row = { ...row, ...data, updated_at: new Date() };
    return { count: 1 };
  });
  database.crmSyncOperation.findUniqueOrThrow.mockImplementation(async ({ where }) => {
    if (where.account_id && where.account_id !== row.account_id) throw new Error("not found");
    return { ...row };
  });
  database.crmSyncOperation.update.mockImplementation(async ({ data }) => {
    row = { ...row, ...data };
    return { ...row };
  });
  database.call.findFirst.mockResolvedValue({
    id: "call", status: "completed", from_number: "+15555550199", started_at: new Date(), summary: "Callback requested",
  });
  database.leadEvent.findFirst.mockResolvedValue({ id: "lead", notes: "Call back" });
  database.leadQualification.findUnique.mockResolvedValue({ qualification_status: "qualified" });
});

test("concurrent retries produce only one set of external effects", async () => {
  const provider = new MockCrmProvider();
  const contact = vi.spyOn(provider, "createContact");
  const activity = vi.spyOn(provider, "createCallActivity");
  const task = vi.spyOn(provider, "createFollowUpTask");
  const params = { accountId: "account", callId: "call", providerOverride: provider };
  const results = await Promise.all([runCrmSyncForCall(params), runCrmSyncForCall(params)]);
  expect(results.every((result) => result.ok)).toBe(true);
  expect(contact).toHaveBeenCalledOnce();
  expect(activity).toHaveBeenCalledOnce();
  expect(task).toHaveBeenCalledOnce();
  expect(row.status).toBe("succeeded");
  expect(row.attempt_count).toBe(1);
});

test.each(["processing", "cancelled", "succeeded", "review_required"])("does not execute an operation in %s", async (status) => {
  row.status = status;
  await runCrmSyncForCall({ accountId: "account", callId: "call", providerOverride: new MockCrmProvider() });
  expect(database.crmSyncOperation.updateMany).not.toHaveBeenCalled();
  expect(database.call.findFirst).not.toHaveBeenCalled();
});

test("a claim abandoned past its TTL is reclaimed and continued, not repeated", async () => {
  row.status = "processing";
  row.updated_at = new Date(Date.now() - 20 * 60 * 1000);
  row.provider_contact_id = "contact-1";
  const provider = new MockCrmProvider();
  const contact = vi.spyOn(provider, "createContact");
  const activity = vi.spyOn(provider, "createCallActivity");
  const result = await runCrmSyncForCall({ accountId: "account", callId: "call", providerOverride: provider });
  expect(result).toMatchObject({ ok: true, data: { status: "succeeded", provider_contact_id: "contact-1" } });
  expect(contact).not.toHaveBeenCalled();
  expect(activity).toHaveBeenCalledOnce();
  expect(row.attempt_count).toBe(1);
  expect(database.crmSyncOperation.upsert).not.toHaveBeenCalled();
});

test("a worker whose claim was superseded reaches no provider and writes no state", async () => {
  // The generation read after claiming belongs to this worker; a later
  // reclaim (simulated by bumping attempt_count) must fence it out before
  // the first provider call and out of the failure write.
  database.crmSyncOperation.findUniqueOrThrow.mockImplementationOnce(async () => {
    const snapshot = { ...row };
    row.attempt_count = Number(row.attempt_count) + 1;
    return snapshot;
  });
  const provider = new MockCrmProvider();
  const lookup = vi.spyOn(provider, "findContacts");
  const activity = vi.spyOn(provider, "createCallActivity");
  const result = await runCrmSyncForCall({ accountId: "account", callId: "call", providerOverride: provider });
  expect(result.ok).toBe(false);
  expect(lookup).not.toHaveBeenCalled();
  expect(activity).not.toHaveBeenCalled();
  expect(row.status).toBe("processing");
});

test("a worker reclaimed mid-flight stops at its next write and creates no further provider objects", async () => {
  // The contact create succeeds, then the operation is reclaimed (attempt_count
  // moves). The generation fence on the provider-id write must stop this worker
  // before the activity is created and before any state is persisted.
  const provider = new MockCrmProvider();
  const activity = vi.spyOn(provider, "createCallActivity");
  vi.spyOn(provider, "createContact").mockImplementation(async () => {
    row.attempt_count = Number(row.attempt_count) + 1;
    return { providerContactId: "contact-mid-flight" };
  });
  const result = await runCrmSyncForCall({ accountId: "account", callId: "call", providerOverride: provider });
  expect(result.ok).toBe(false);
  expect(activity).not.toHaveBeenCalled();
  expect(row.provider_contact_id).toBeUndefined();
  expect(row.status).toBe("processing");
});

test("a failed contender cannot overwrite the current worker's state", async () => {
  database.crmSyncOperation.updateMany.mockRejectedValue(new Error("claim unavailable"));
  const result = await runCrmSyncForCall({ accountId: "account", callId: "call", providerOverride: new MockCrmProvider() });
  expect(result.ok).toBe(false);
  expect(database.crmSyncOperation.update).not.toHaveBeenCalled();
});

test("a tenant mismatch cannot claim or disclose another tenant's operation", async () => {
  database.crmSyncOperation.findUnique.mockImplementationOnce(async () => {
    const snapshot = { ...row };
    row.account_id = "other-account";
    return snapshot;
  });
  const provider = new MockCrmProvider();
  const lookup = vi.spyOn(provider, "findContacts");
  const result = await runCrmSyncForCall({ accountId: "account", callId: "call", providerOverride: provider });
  expect(result.ok).toBe(false);
  expect(row.status).toBe("retryable_failed");
  expect(row.attempt_count).toBe(0);
  expect(database.crmSyncOperation.update).not.toHaveBeenCalled();
  expect(lookup).not.toHaveBeenCalled();
});

test("a failed owner can retry without repeating persisted provider objects", async () => {
  const provider = new MockCrmProvider();
  const contact = vi.spyOn(provider, "createContact");
  const activity = vi.spyOn(provider, "createCallActivity").mockRejectedValueOnce(new Error("provider unavailable"));
  const params = { accountId: "account", callId: "call", providerOverride: provider };
  await runCrmSyncForCall(params);
  expect(row.status).toBe("retryable_failed");
  await runCrmSyncForCall(params);
  expect(row.status).toBe("succeeded");
  expect(contact).toHaveBeenCalledOnce();
  expect(activity).toHaveBeenCalledTimes(2);
});
