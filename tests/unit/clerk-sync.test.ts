import { beforeEach, describe, expect, test, vi } from "vitest";

const m = vi.hoisted(() => ({
  db: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    account: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    webhookEvent: { update: vi.fn(), findUnique: vi.fn() },
  },
  recordWebhookEvent: vi.fn(),
  recordAuditLog: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({ db: m.db }));
vi.mock("@/lib/data/webhookEvents", () => ({ recordWebhookEvent: m.recordWebhookEvent }));
vi.mock("@/lib/data/auditLogs", () => ({ recordAuditLog: m.recordAuditLog }));

import { handleClerkEvent } from "@/lib/auth/clerk-sync";

function call(type: string, data: Record<string, unknown>) {
  return handleClerkEvent({
    event: { type, data },
    eventId: "msg_1",
    rawBody: JSON.stringify({ type, data }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.AJ_DIGITAL_CLERK_ORG_ID;
  m.recordWebhookEvent.mockResolvedValue({
    ok: true,
    data: { id: "wh_1", process_status: "received" },
  });
  m.db.webhookEvent.update.mockResolvedValue({});
  m.db.webhookEvent.findUnique.mockResolvedValue(null);
  m.db.user.findUnique.mockResolvedValue(null);
  m.db.user.update.mockResolvedValue({});
  m.db.user.create.mockResolvedValue({});
  m.db.user.updateMany.mockResolvedValue({ count: 1 });
  m.db.account.findUnique.mockResolvedValue(null);
  m.db.account.create.mockResolvedValue({});
  m.db.account.update.mockResolvedValue({});
});

const userPayload = {
  id: "clerk_u1",
  email_addresses: [{ id: "em1", email_address: "ada@example.com" }],
  primary_email_address_id: "em1",
  first_name: "Ada",
  last_name: "Lovelace",
};

describe("handleClerkEvent — provisioning is conservative and fail-closed", () => {
  test("user.created creates a User at the lowest role (no elevation)", async () => {
    const res = await call("user.created", userPayload);
    expect(res.ok).toBe(true);
    expect(m.db.user.create).toHaveBeenCalledTimes(1);
    expect(m.db.user.create.mock.calls[0][0].data).toMatchObject({
      clerk_user_id: "clerk_u1",
      email: "ada@example.com",
      name: "Ada Lovelace",
      role: "client_viewer",
    });
  });

  test("user.created without an email does not create or link a row", async () => {
    await call("user.created", { id: "clerk_u1" });
    expect(m.db.user.create).not.toHaveBeenCalled();
    expect(m.db.user.update).not.toHaveBeenCalled();
  });

  test("user.updated patches email/name on an existing row only", async () => {
    m.db.user.findUnique.mockResolvedValue({ id: "u_db", account_id: null });
    await call("user.updated", userPayload);
    expect(m.db.user.create).not.toHaveBeenCalled();
    expect(m.db.user.update).toHaveBeenCalledWith({
      where: { clerk_user_id: "clerk_u1" },
      data: { email: "ada@example.com", name: "Ada Lovelace" },
    });
  });

  test("user.deleted unlinks clerk_user_id and writes a security audit log", async () => {
    m.db.user.findUnique.mockResolvedValue({ id: "u_db", account_id: "acct_1" });
    await call("user.deleted", { id: "clerk_u1", deleted: true });
    expect(m.db.user.update).toHaveBeenCalledWith({
      where: { clerk_user_id: "clerk_u1" },
      data: { clerk_user_id: null },
    });
    expect(m.recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_type: "webhook",
        action: "clerk.user.deleted",
        category: "security",
        target_id: "u_db",
      }),
    );
  });

  test("organization.created creates an Account with safe defaults", async () => {
    await call("organization.created", {
      id: "org_clerk_1",
      name: "Acme Plumbing",
      slug: "acme-plumbing",
    });
    expect(m.db.account.create).toHaveBeenCalledTimes(1);
    expect(m.db.account.create.mock.calls[0][0].data).toMatchObject({
      clerk_org_id: "org_clerk_1",
      name: "Acme Plumbing",
      slug: "acme-plumbing",
      status: "lead",
    });
  });

  test("control organization events never create a tenant Account", async () => {
    process.env.AJ_DIGITAL_CLERK_ORG_ID = "org_control";
    await call("organization.created", {
      id: "org_control",
      name: "AJ Digital",
      slug: "aj-digital",
    });
    expect(m.db.account.findUnique).not.toHaveBeenCalled();
    expect(m.db.account.create).not.toHaveBeenCalled();
    expect(m.db.account.update).not.toHaveBeenCalled();
  });

  const membership = {
    organization: { id: "org_clerk_1" },
    public_user_data: { user_id: "clerk_u1" },
    role: "org:admin",
  };

  test("membership.created binds account_id but never elevates role", async () => {
    m.db.account.findUnique.mockResolvedValue({ id: "acct_1" });
    await call("organizationMembership.created", membership);
    expect(m.db.user.updateMany).toHaveBeenCalledWith({
      where: { clerk_user_id: "clerk_u1" },
      data: { account_id: "acct_1" },
    });
    // No `role` in the update — Clerk's "org:admin" must not become client_admin.
    expect(m.db.user.updateMany.mock.calls[0][0].data).not.toHaveProperty("role");
  });

  test("control membership clears tenant binding without changing DB role", async () => {
    process.env.AJ_DIGITAL_CLERK_ORG_ID = "org_control";
    await call("organizationMembership.created", {
      ...membership,
      organization: { id: "org_control" },
    });
    expect(m.db.account.findUnique).not.toHaveBeenCalled();
    expect(m.db.user.updateMany).toHaveBeenCalledWith({
      where: { clerk_user_id: "clerk_u1" },
      data: { account_id: null },
    });
    expect(m.db.user.updateMany.mock.calls[0][0].data).not.toHaveProperty("role");
  });

  test("membership.created before its org is synced is retryable, not acked", async () => {
    m.db.account.findUnique.mockResolvedValue(null);
    const res = await call("organizationMembership.created", membership);
    expect(m.db.user.updateMany).not.toHaveBeenCalled();
    expect(res.ok).toBe(false);
    expect(m.db.webhookEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ process_status: "error" }) }),
    );
  });

  test("membership.created before its user is synced is retryable, not acked", async () => {
    m.db.account.findUnique.mockResolvedValue({ id: "acct_1" });
    m.db.user.updateMany.mockResolvedValue({ count: 0 });
    const res = await call("organizationMembership.created", membership);
    expect(res.ok).toBe(false);
    expect(m.db.webhookEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ process_status: "error" }) }),
    );
  });

  test("membership.deleted detaches the user and resets to client_viewer", async () => {
    await call("organizationMembership.deleted", membership);
    expect(m.db.user.updateMany).toHaveBeenCalledWith({
      where: { clerk_user_id: "clerk_u1" },
      data: { account_id: null, role: "client_viewer" },
    });
  });

  test("control membership deletion preserves the authoritative DB role", async () => {
    process.env.AJ_DIGITAL_CLERK_ORG_ID = "org_control";
    await call("organizationMembership.deleted", {
      ...membership,
      organization: { id: "org_control" },
    });
    expect(m.db.user.updateMany).toHaveBeenCalledWith({
      where: { clerk_user_id: "clerk_u1" },
      data: { account_id: null },
    });
    expect(m.db.user.updateMany.mock.calls[0][0].data).not.toHaveProperty("role");
  });
});

describe("handleClerkEvent — ledger / replay safety", () => {
  test("marks the ledger row processed on success", async () => {
    await call("user.created", userPayload);
    expect(m.recordWebhookEvent).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "clerk", signature_valid: true }),
    );
    expect(m.db.webhookEvent.update).toHaveBeenCalledWith({
      where: { id: "wh_1" },
      data: { process_status: "processed", processed_at: expect.any(Date) },
    });
  });

  test("an already-processed event short-circuits without dispatching", async () => {
    m.recordWebhookEvent.mockResolvedValue({
      ok: true,
      data: { id: "wh_1", process_status: "duplicate" },
    });
    m.db.webhookEvent.findUnique.mockResolvedValue({ process_status: "processed" });
    const res = await call("user.created", userPayload);
    expect(res).toEqual({ ok: true, data: { status: "duplicate" } });
    expect(m.db.user.create).not.toHaveBeenCalled();
    expect(m.db.user.findUnique).not.toHaveBeenCalled();
  });

  test("a previously-errored event is re-dispatched on retry, not dropped", async () => {
    // Ledger row exists but never reached "processed" (transient failure / early
    // delivery). Clerk redelivers the same id; we must re-run reconciliation.
    m.recordWebhookEvent.mockResolvedValue({
      ok: true,
      data: { id: "wh_1", process_status: "duplicate" },
    });
    m.db.webhookEvent.findUnique.mockResolvedValue({ process_status: "error" });
    const res = await call("user.created", userPayload);
    expect(res).toEqual({ ok: true, data: { status: "processed" } });
    expect(m.db.user.create).toHaveBeenCalledTimes(1);
    expect(m.db.webhookEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ process_status: "processed" }) }),
    );
  });

  test("propagates a ledger write failure", async () => {
    m.recordWebhookEvent.mockResolvedValue({
      ok: false,
      error: { code: "no_database", message: "x" },
    });
    const res = await call("user.created", userPayload);
    expect(res.ok).toBe(false);
  });

  test("records an error status when dispatch throws", async () => {
    m.db.user.findUnique.mockRejectedValue(new Error("db down"));
    const res = await call("user.updated", userPayload);
    expect(res.ok).toBe(false);
    expect(m.db.webhookEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "wh_1" },
        data: expect.objectContaining({ process_status: "error" }),
      }),
    );
  });
});
