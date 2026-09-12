import { beforeEach, expect, test, vi } from "vitest";
import { runCrmSyncForCall } from "@/lib/crm/syncFinalizedCall";
import { MockCrmProvider } from "@/lib/providers/crm/mock";

const database = vi.hoisted(() => ({
  crmSyncOperation: { upsert: vi.fn(), updateMany: vi.fn(), update: vi.fn(), findUniqueOrThrow: vi.fn() },
  call: { findFirst: vi.fn() },
  contact: { findFirst: vi.fn() },
  leadEvent: { findFirst: vi.fn() },
  leadQualification: { findUnique: vi.fn() },
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
  database.crmSyncOperation.upsert.mockImplementation(async () => ({ ...row }));
  database.crmSyncOperation.updateMany.mockImplementation(async ({ where, data }) => {
    if (!where.status.in.includes(row.status)) return { count: 0 };
    row = { ...row, ...data, attempt_count: Number(row.attempt_count) + 1 };
    return { count: 1 };
  });
  database.crmSyncOperation.findUniqueOrThrow.mockImplementation(async () => ({ ...row }));
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

test("a failed contender cannot overwrite the current worker's state", async () => {
  database.crmSyncOperation.updateMany.mockRejectedValue(new Error("claim unavailable"));
  const result = await runCrmSyncForCall({ accountId: "account", callId: "call", providerOverride: new MockCrmProvider() });
  expect(result.ok).toBe(false);
  expect(database.crmSyncOperation.update).not.toHaveBeenCalled();
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
