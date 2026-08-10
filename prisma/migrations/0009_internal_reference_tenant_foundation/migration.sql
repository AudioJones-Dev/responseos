-- Mock-first internal reference tenant foundation.
-- Additive only: classification, reusable agent profiles, and generic opportunities.

CREATE TYPE "AccountType" AS ENUM ('customer', 'internal', 'internal_demo', 'sandbox');
CREATE TYPE "AgentProfileType" AS ENUM ('recruiter_receptionist', 'consulting_receptionist', 'professional_assistant', 'demo_mode');
CREATE TYPE "OpportunityType" AS ENUM ('service', 'employment', 'contract', 'consulting', 'partnership', 'media', 'demo', 'other');
CREATE TYPE "OpportunityStatus" AS ENUM ('new', 'qualified', 'scheduled', 'escalated', 'closed_won', 'closed_lost', 'archived');

ALTER TABLE "Account"
ADD COLUMN "account_type" "AccountType" NOT NULL DEFAULT 'customer';

CREATE TABLE "AgentProfile" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "profile_type" "AgentProfileType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "policy_json" JSONB,
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "contact_id" TEXT,
    "source_call_id" TEXT,
    "source_conversation_id" TEXT,
    "appointment_id" TEXT,
    "opportunity_type" "OpportunityType" NOT NULL,
    "status" "OpportunityStatus" NOT NULL DEFAULT 'new',
    "interest_level" TEXT,
    "summary" TEXT,
    "details_json" JSONB,
    "questions_asked" JSONB,
    "recommended_preparation" JSONB,
    "next_action" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgentProfile_account_id_slug_key" ON "AgentProfile"("account_id", "slug");
CREATE INDEX "AgentProfile_account_id_idx" ON "AgentProfile"("account_id");
CREATE INDEX "Opportunity_account_id_idx" ON "Opportunity"("account_id");
CREATE INDEX "Opportunity_account_id_status_idx" ON "Opportunity"("account_id", "status");
CREATE INDEX "Opportunity_contact_id_idx" ON "Opportunity"("contact_id");
CREATE INDEX "Opportunity_appointment_id_idx" ON "Opportunity"("appointment_id");
