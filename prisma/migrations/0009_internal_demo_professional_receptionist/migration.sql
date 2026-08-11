-- ResponseOS — internal demo account + professional receptionist substrate
-- (ADR-0046).
--
-- Purely additive migration. Adds:
--   * Five new enum types: AccountType, AgentProfileType,
--     ProfessionalOpportunityType, ProfessionalOpportunityStatus,
--     ProfessionalInterestLevel.
--   * One new column on the existing Account table:
--       - account_type  AccountType NOT NULL DEFAULT 'customer'
--   * Two new tables: AgentProfile, ProfessionalOpportunity.
--   * Their indexes + the (account_id, slug) unique constraint.
--
-- No existing table, column, enum, or index is altered or dropped, and
-- no data moves. `account_type` carries a default so every existing
-- Account row classifies as `customer` without backfill.
--
-- Classification is administrative only: it drives reporting exclusion
-- and console labelling. It does NOT gate tenant isolation, auth,
-- audit, provider resolution, or any other runtime behaviour — the
-- internal demo tenant reads and writes through the same accessors as
-- a paying customer tenant.
--
-- No FK constraints are introduced, matching the rest of this schema.
--
-- See:
--   - docs/DECISIONS.md ADR-0046
--   - docs/product/responseos-internal-demo-professional-receptionist.md

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('customer', 'internal', 'internal_demo', 'sandbox');

-- CreateEnum
CREATE TYPE "AgentProfileType" AS ENUM ('recruiter_receptionist', 'consulting_receptionist', 'professional_assistant', 'demo_mode');

-- CreateEnum
CREATE TYPE "ProfessionalOpportunityType" AS ENUM ('employment', 'contract', 'consulting', 'partnership', 'media');

-- CreateEnum
CREATE TYPE "ProfessionalOpportunityStatus" AS ENUM ('new', 'qualifying', 'scheduled', 'escalated', 'closed');

-- CreateEnum
CREATE TYPE "ProfessionalInterestLevel" AS ENUM ('low', 'medium', 'high');

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "account_type" "AccountType" NOT NULL DEFAULT 'customer';

-- CreateTable
CREATE TABLE "AgentProfile" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "AgentProfileType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "system_policy_json" JSONB,
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfessionalOpportunity" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "contact_id" TEXT,
    "agent_profile_id" TEXT,
    "opportunity_type" "ProfessionalOpportunityType" NOT NULL,
    "company" TEXT,
    "role_title" TEXT,
    "recruiter_name" TEXT,
    "recruiter_email" TEXT,
    "recruiter_phone" TEXT,
    "interest_level" "ProfessionalInterestLevel",
    "status" "ProfessionalOpportunityStatus" NOT NULL DEFAULT 'new',
    "source_call_id" TEXT,
    "source_conversation_id" TEXT,
    "appointment_id" TEXT,
    "questions_asked" JSONB,
    "summary" TEXT,
    "recommended_preparation" JSONB,
    "next_action" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfessionalOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentProfile_account_id_idx" ON "AgentProfile"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "AgentProfile_account_id_slug_key" ON "AgentProfile"("account_id", "slug");

-- CreateIndex
CREATE INDEX "ProfessionalOpportunity_account_id_idx" ON "ProfessionalOpportunity"("account_id");

-- CreateIndex
CREATE INDEX "ProfessionalOpportunity_account_id_status_idx" ON "ProfessionalOpportunity"("account_id", "status");

-- CreateIndex
CREATE INDEX "ProfessionalOpportunity_created_at_idx" ON "ProfessionalOpportunity"("created_at");

