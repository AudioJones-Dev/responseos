-- ResponseOS v0.2 closeout step 2.3, PR 31D: audit_logs expansion.
--
-- Purely additive migration. Adds:
--   * One new enum type: AuditCategory.
--   * Six new nullable columns on the existing AuditLog table:
--       - actor_role     UserRole?
--       - category       AuditCategory?
--       - reason         TEXT
--       - before_ref     JSONB
--       - after_ref      JSONB
--       - expires_at     TIMESTAMP(3)
--   * One new index on AuditLog(category) to support the break-glass
--     and category-filtered reads the future privileged raw-transcript
--     read accessor will write against.
--
-- No existing tables, columns, enums, or indexes are altered or
-- dropped. No data movement. All new columns are NULL by default for
-- existing seeded rows, so the existing 6 seeded AuditLog entries
-- (audit_mock_1 through audit_mock_6) remain valid without backfill.
--
-- Hard guardrail (per ADR-0019 step 2.3 + operator authorization for
-- 31D): this PR ships the AuditLog substrate for break-glass
-- auditability. It does NOT implement the privileged raw-transcript
-- read accessor, the break-glass retrieval flow, or any object-storage
-- access. Those land in a separate PR after 31D is merged + reviewed.
--
-- See:
--   - docs/product/RESPONSEOS_V0_2_REMAINING_MODELS_IMPLEMENTATION_PLAN.md §4
--   - docs/architecture/RESPONSEOS_EVENT_SCHEMA.md §7
--   - docs/architecture/RESPONSEOS_DATA_MODEL.md §6
--   - issue #27 (roadmap checkpoint)

-- CreateEnum
CREATE TYPE "AuditCategory" AS ENUM ('security', 'data_access', 'break_glass', 'integration', 'workflow', 'system');

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN "actor_role" "UserRole";
ALTER TABLE "AuditLog" ADD COLUMN "category" "AuditCategory";
ALTER TABLE "AuditLog" ADD COLUMN "reason" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "before_ref" JSONB;
ALTER TABLE "AuditLog" ADD COLUMN "after_ref" JSONB;
ALTER TABLE "AuditLog" ADD COLUMN "expires_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "AuditLog_category_idx" ON "AuditLog"("category");
