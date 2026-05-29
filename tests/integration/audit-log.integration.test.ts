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

  // ---- 31D expansion -----------------------------------------------------

  test("31D expansion: existing seeded rows remain valid with all new columns null", async () => {
    // The 6 pre-31D seeded audit rows (audit_mock_1..audit_mock_6) carry
    // no value for any of the new columns. The migration is additive
    // and the columns are nullable, so they should read back as null
    // without backfill.
    const rows = await prisma.auditLog.findMany({
      where: { id: { in: ["audit_mock_1", "audit_mock_2", "audit_mock_3", "audit_mock_4", "audit_mock_5", "audit_mock_6"] } },
      orderBy: { id: "asc" },
      select: {
        id: true,
        actor_role: true,
        category: true,
        reason: true,
        before_ref: true,
        after_ref: true,
        expires_at: true,
      },
    });
    expect(rows).toHaveLength(6);
    for (const row of rows) {
      expect(row.actor_role).toBeNull();
      expect(row.category).toBeNull();
      expect(row.reason).toBeNull();
      expect(row.before_ref).toBeNull();
      expect(row.after_ref).toBeNull();
      expect(row.expires_at).toBeNull();
    }
  });

  test("31D expansion: break_glass seed row carries the full expanded payload", async () => {
    // audit_mock_7 is the canonical example of the break-glass category.
    const row = await prisma.auditLog.findUniqueOrThrow({
      where: { id: "audit_mock_7" },
    });
    expect(row.actor_role).toBe("aj_admin");
    expect(row.category).toBe("break_glass");
    expect(row.reason).toBe("Incident #demo investigation");
    expect(row.before_ref).toEqual({ artifact_state: "redacted_only_visible" });
    expect(row.after_ref).toEqual({ artifact_state: "raw_briefly_revealed" });
    expect(row.expires_at).toBeInstanceOf(Date);
    expect(row.target_type).toBe("CallTranscript");
    expect(row.target_id).toBe("xcr_mock_1");
  });

  test("31D expansion: recordAuditLog persists the full expanded payload", async () => {
    const expiresAt = new Date("2026-06-01T00:00:00.000Z");
    const result = await AuditLogs.recordAuditLog({
      account_id: "org_mock_1",
      actor_user_id: "user_aj_admin_1",
      actor_type: "user",
      actor_role: "aj_admin",
      action: "transcript.break_glass.read",
      category: "break_glass",
      target_type: "CallTranscript",
      target_id: "xcr_test_001",
      reason: "Test investigation",
      before_ref: { artifact: "redacted" },
      after_ref: { artifact: "raw_briefly_revealed" },
      expires_at: expiresAt,
    });
    expect(result).toEqual({ ok: true, data: { recorded: true } });

    const row = await prisma.auditLog.findFirstOrThrow({
      where: { target_id: "xcr_test_001" },
    });
    expect(row.actor_role).toBe("aj_admin");
    expect(row.category).toBe("break_glass");
    expect(row.reason).toBe("Test investigation");
    expect(row.before_ref).toEqual({ artifact: "redacted" });
    expect(row.after_ref).toEqual({ artifact: "raw_briefly_revealed" });
    expect(row.expires_at?.toISOString()).toBe(expiresAt.toISOString());
  });

  test("31D expansion: listAuditLogs supports the category filter for break_glass reads", async () => {
    const breakGlass = await AuditLogs.listAuditLogs({
      accountId: "org_mock_1",
      category: "break_glass",
    });
    expect(breakGlass.ok).toBe(true);
    if (!breakGlass.ok) return;
    // Seed contains audit_mock_7 with category = break_glass; the other
    // seeded rows have null category and must be excluded.
    expect(breakGlass.data.map((r) => r.id)).toContain("audit_mock_7");
    expect(breakGlass.data.every((r) => r.category === "break_glass")).toBe(true);

    const security = await AuditLogs.listAuditLogs({
      accountId: "org_mock_1",
      category: "security",
    });
    expect(security.ok).toBe(true);
    if (!security.ok) return;
    expect(security.data).toHaveLength(0);
  });

  test("31D expansion: legacy recordAuditLog calls without new fields still succeed", async () => {
    // Backwards-compatibility: pre-31D call sites continue to work
    // unchanged. The new columns default to null when omitted.
    const result = await AuditLogs.recordAuditLog({
      account_id: "org_mock_1",
      actor_user_id: "user_aj_admin_1",
      actor_type: "user",
      action: "legacy.call.shape",
      target_type: "LeadEvent",
      target_id: "lead_legacy_test",
    });
    expect(result).toEqual({ ok: true, data: { recorded: true } });

    const row = await prisma.auditLog.findFirstOrThrow({
      where: { target_id: "lead_legacy_test" },
    });
    expect(row.category).toBeNull();
    expect(row.reason).toBeNull();
    expect(row.actor_role).toBeNull();
  });
});
