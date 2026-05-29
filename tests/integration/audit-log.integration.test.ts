import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { AuditLogs } from "@/lib/data";
import { makeAuditLog } from "../factories";
import { disconnectTestDb, prisma, resetAndSeedTestDb, setDevSession } from "./setup";

describe("audit log integration", () => {
  beforeEach(async () => {
    await resetAndSeedTestDb();
    setDevSession("aj_admin");
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  test("recordAuditLog writes the documented append-only row shape", async () => {
    const entry = makeAuditLog(
      { accountId: "org_mock_1", actorUserId: "user_aj_admin_1" },
      {
        action: "lead.qualified",
        target_type: "LeadEvent",
        target_id: "lead_test_audit_001",
        metadata_json: { before: { status: "new" }, after: { status: "qualified" } },
        ip_address: "203.0.113.10",
        user_agent: "vitest-audit-log",
      },
    );

    const result = await AuditLogs.recordAuditLog({
      account_id: entry.account_id ?? undefined,
      actor_user_id: entry.actor_user_id ?? undefined,
      actor_type: entry.actor_type,
      action: entry.action,
      target_type: entry.target_type ?? undefined,
      target_id: entry.target_id ?? undefined,
      metadata_json: entry.metadata_json,
      ip_address: entry.ip_address ?? undefined,
      user_agent: entry.user_agent ?? undefined,
    });
    expect(result).toEqual({ ok: true, data: { recorded: true } });

    const row = await prisma.auditLog.findFirstOrThrow({
      where: { action: "lead.qualified", target_id: "lead_test_audit_001" },
    });
    expect(row).toMatchObject({
      account_id: "org_mock_1",
      actor_user_id: "user_aj_admin_1",
      actor_type: "user",
      action: "lead.qualified",
      target_type: "LeadEvent",
      target_id: "lead_test_audit_001",
      metadata_json: { before: { status: "new" }, after: { status: "qualified" } },
      ip_address: "203.0.113.10",
      user_agent: "vitest-audit-log",
    });
    expect(row.created_at).toBeInstanceOf(Date);
  });

  test("tenant-scoped audit reads deny cross-tenant client admins", async () => {
    await prisma.auditLog.create({
      data: makeAuditLog({ accountId: "org_mock_2", actorUserId: "user_aj_admin_1" }),
    });

    setDevSession("client_admin@org_mock_1");
    const result = await AuditLogs.listAuditLogs({ accountId: "org_mock_2" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("tenant_scope_denied");
  });
});
