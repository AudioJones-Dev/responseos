import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { deliverQualifiedCallNotification, dispatchQualifiedNotificationDeliveries, listQualifiedNotificationDeliveries, retryQualifiedNotificationDelivery } from "@/lib/notifications/qualifiedCallDelivery";

const mocks = vi.hoisted(() => ({ role: vi.fn(), handoffs: vi.fn(), deliveries: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireRole: mocks.role }));
vi.mock("@/lib/db/client", () => ({ db: { qualifiedCallHandoff: { findMany: mocks.handoffs }, qualifiedNotificationDelivery: { findMany: mocks.deliveries } } }));

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("RESPONSEOS_FRL_HANDOFF_ACCOUNT_ID", "synthetic-tenant");
  vi.stubEnv("RESPONSEOS_FRL_QUALIFIED_HANDOFF_ENABLED", "true");
  vi.stubEnv("RESPONSEOS_FRL_NOTIFICATION_DELIVERY_ENABLED", "false");
});
afterEach(() => vi.unstubAllEnvs());

test("disabled and foreign tenant dispatch performs no database or provider work", async () => {
  expect(await deliverQualifiedCallNotification({ accountId: "synthetic-tenant", callId: "call" })).toEqual({ ok: true, data: null });
  vi.stubEnv("RESPONSEOS_FRL_NOTIFICATION_DELIVERY_ENABLED", "true");
  expect(await deliverQualifiedCallNotification({ accountId: "foreign", callId: "call" })).toEqual({ ok: true, data: null });
  expect(mocks.handoffs).not.toHaveBeenCalled();
  expect(mocks.deliveries).not.toHaveBeenCalled();
});

test("mock fallback never consumes a real outbox or claims delivery", async () => {
  vi.stubEnv("RESPONSEOS_FRL_NOTIFICATION_DELIVERY_ENABLED", "true");
  vi.stubEnv("RESPONSEOS_LIVE_RESEND_ENABLED", "false");
  const result = await deliverQualifiedCallNotification({ accountId: "synthetic-tenant", callId: "call" });
  expect(result).toMatchObject({ ok: false, error: { code: "live_email_transport_unavailable" } });
  expect(mocks.handoffs).not.toHaveBeenCalled();
});

test("inspection, batch dispatch and retry require operator/admin role", async () => {
  mocks.role.mockRejectedValue(new Error("role_denied"));
  expect((await listQualifiedNotificationDeliveries()).ok).toBe(false);
  expect((await dispatchQualifiedNotificationDeliveries()).ok).toBe(false);
  expect((await retryQualifiedNotificationDelivery("call")).ok).toBe(false);
  expect(mocks.role).toHaveBeenCalledWith(["aj_admin", "operator"]);
  expect(mocks.deliveries).not.toHaveBeenCalled();
  expect(mocks.handoffs).not.toHaveBeenCalled();
});

test("disabled operator batch and retry fail closed", async () => {
  expect(await dispatchQualifiedNotificationDeliveries()).toMatchObject({ ok: false, error: { code: "qualified_delivery_disabled" } });
  expect(await retryQualifiedNotificationDelivery("call")).toMatchObject({ ok: false, error: { code: "qualified_delivery_disabled" } });
  expect(mocks.handoffs).not.toHaveBeenCalled();
});

test("batch splits new outbox work from retries and excludes held/terminal deliveries", async () => {
  vi.stubEnv("RESPONSEOS_FRL_NOTIFICATION_DELIVERY_ENABLED", "true");
  mocks.deliveries.mockResolvedValueOnce([{ handoff_id: "already-tracked" }]).mockResolvedValueOnce([]);
  mocks.handoffs.mockResolvedValue([]);
  expect(await dispatchQualifiedNotificationDeliveries()).toEqual({ ok: true, data: { results: [] } });
  expect(mocks.handoffs).toHaveBeenCalledWith(expect.objectContaining({
    where: { account_id: "synthetic-tenant", status: "queued", id: { notIn: ["already-tracked"] } }, take: 10,
  }));
  expect(mocks.deliveries.mock.calls[1][0]).toMatchObject({
    where: { account_id: "synthetic-tenant", OR: [
      { status: { in: ["pending", "retryable_failed", "accepted"] } },
      { status: "processing", lease_expires_at: { lte: expect.any(Date) } },
    ] }, take: 10,
  });
});

test("hosted execution cannot use the privileged developer fallback when auth is unset", async () => {
  vi.stubEnv("RESPONSEOS_FRL_NOTIFICATION_DELIVERY_ENABLED", "true");
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("RESPONSEOS_REQUIRE_AUTH", "");
  expect(await deliverQualifiedCallNotification({ accountId: "synthetic-tenant", callId: "call" })).toMatchObject({ ok: false, error: { code: "hosted_auth_required" } });
  expect(await dispatchQualifiedNotificationDeliveries()).toMatchObject({ ok: false, error: { code: "hosted_auth_required" } });
  expect(await listQualifiedNotificationDeliveries()).toMatchObject({ ok: false, error: { code: "hosted_auth_required" } });
  expect(mocks.handoffs).not.toHaveBeenCalled();
  expect(mocks.deliveries).not.toHaveBeenCalled();
});

test("unexpected inspection errors do not expose database or recipient details", async () => {
  mocks.deliveries.mockRejectedValue(new Error("private-recipient@example.com confidential"));
  const result = await listQualifiedNotificationDeliveries();
  expect(result).toMatchObject({ ok: false, error: { code: "qualified_delivery_operation_failed" } });
  expect(JSON.stringify(result)).not.toContain("private-recipient");
});
