-- ResponseOS v0.2 closeout step 2.4 PR 32A: Clerk identity schema.
--
-- Purely additive migration. Adds two nullable identifier columns
-- + two unique indexes:
--
--   * User.clerk_user_id        TEXT NULL  UNIQUE
--   * Account.clerk_org_id      TEXT NULL  UNIQUE
--
-- No existing tables, columns, enums, or indexes are altered or
-- dropped. No data movement. All existing seeded User and Account
-- rows remain valid: both new columns read back NULL until a Clerk
-- webhook (32C) or admin tooling (later PR) wires them.
--
-- Note on indexing: the `@unique` constraint already creates an index
-- that serves equality lookups (the SQL below uses CREATE UNIQUE INDEX,
-- which Postgres treats as both a uniqueness constraint and a B-tree
-- index). The step-2.4 plan §3/§5 sketched a separate non-unique
-- `@@index([clerk_org_id])` for "secondary lookup" — that would be a
-- redundant duplicate index on the same column. Dropping it for 32A;
-- the unique index serves the future Clerk-org lookup path equally
-- well. Documented in the 32A PR body.
--
-- Hard guardrail (per ADR-0019 step 2.4 + operator authorization for
-- 32A): this PR ships the SCHEMA only. It does NOT add the Clerk
-- session derivation, the Clerk webhook handler, route protection,
-- JIT provisioning, or any auth behavior change. Those land in 32B
-- and 32C.
--
-- See:
--   - docs/product/RESPONSEOS_V0_2_CLERK_ALIGNMENT_PLAN.md §4.2, §4.3, §5
--   - docs/DECISIONS.md ADR-0005 (Clerk for Standard-lane auth)
--   - docs/DECISIONS.md ADR-0019 (closeout-first)
--   - issue #27 (roadmap checkpoint)

-- AlterTable
ALTER TABLE "User" ADD COLUMN "clerk_user_id" TEXT;

-- AlterTable
ALTER TABLE "Account" ADD COLUMN "clerk_org_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_clerk_user_id_key" ON "User"("clerk_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "Account_clerk_org_id_key" ON "Account"("clerk_org_id");
