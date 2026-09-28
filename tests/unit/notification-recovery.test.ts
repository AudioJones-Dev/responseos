import { beforeEach, expect, test, vi } from "vitest";
import { dispatchCompletedInteractionNotification, retryCompletedInteractionNotification } from "@/lib/notifications/completedInteraction";
const mocks = vi.hoisted(() => ({ call: vi.fn(), find: vi.fn(), update: vi.fn(), send: vi.fn(), audit: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireRole: async () => ({ user: { id: "operator", role: "operator" } }) }));
vi.mock("@/lib/db/client", () => ({ db: { call: { findFirst: mocks.call }, notification: { findUnique: mocks.find, update: mocks.update }, auditLog: { create: mocks.audit } } }));
const provider = { providerId: "resend" as const, send: mocks.send };
const row = { id: "notification", account_id: "account", call_id: "call", recipient: "owner@example.test", subject: "Callback", message: "Approved summary", status: "failed", provider: "resend", attempt_count: 1, last_error_code: "email_request_failed", provider_message_id: null };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.call.mockResolvedValue({ review_required: false });
  mocks.find.mockResolvedValue({ ...row });
  mocks.update.mockResolvedValue({});
  mocks.send.mockResolvedValue({ providerMessageId: "accepted-id" });
});
test("provider acceptance is reconciled without sending again after persistence failure", async () => {
  mocks.update.mockRejectedValueOnce(new Error("database_write_failed"));
  const first = await dispatchCompletedInteractionNotification({ accountId: "account", callId: "call", providerOverride: provider });
  expect(first).toMatchObject({ ok: true, data: { reason: "accepted_delivery_reconciliation_required" } });
  expect(mocks.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ provider_message_id: "accepted-id", next_attempt_at: expect.any(Date) }) }));
  mocks.find.mockResolvedValue({ ...row, provider_message_id: "accepted-id", last_error_code: "accepted_delivery_reconciliation_required" });
  expect(await retryCompletedInteractionNotification({ id: "notification", providerOverride: provider })).toMatchObject({ ok: true, data: { status: "sent" } });
  expect(mocks.send).toHaveBeenCalledTimes(1);
  // The operator who triggered the retry, and its outcome, are on the audit trail.
  expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "notification_retry_attempt", actor_user_id: "operator", target_type: "Notification", target_id: "notification" }) }));
  expect(mocks.audit).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "notification_retry_outcome", metadata_json: expect.objectContaining({ status: "sent" }) }) }));
});
test("a mock acceptance cannot be reconciled as sent when live delivery is required", async () => {
  mocks.find.mockResolvedValue({ ...row, provider: "mock", provider_message_id: "mock-id", last_error_code: "accepted_delivery_reconciliation_required" });
  const mock = { providerId: "mock" as const, send: mocks.send };
  const result = await dispatchCompletedInteractionNotification({ accountId: "account", callId: "call", requireLiveProvider: true, providerOverride: mock });
  expect(result).toMatchObject({ ok: true, data: { status: "failed", reason: "live_provider_disabled" } });
  expect(mocks.send).not.toHaveBeenCalled();
  expect(mocks.update).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "sent" }) }));
});
test("database read failures stay within the Result contract", async () => {
  mocks.call.mockRejectedValueOnce(new Error("read_failed"));
  expect(await dispatchCompletedInteractionNotification({ accountId: "account", callId: "call", providerOverride: provider })).toMatchObject({ ok: false });
  mocks.find.mockRejectedValueOnce(new Error("read_failed"));
  expect(await retryCompletedInteractionNotification({ id: "notification", providerOverride: provider })).toMatchObject({ ok: false });
});
