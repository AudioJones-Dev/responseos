-- ResponseOS v0.2 closeout step 1: Organization -> Account rename.
--
-- Renames in-place: the enum type, the Organization table, every
-- organization_id FK column on the 13 dependent tables, and the
-- matching indexes/constraints. No data shape changes; no foreign-key
-- constraints exist in the schema (Prisma logical FKs only).
--
-- See ADR-0019 and roadmap checkpoint issue #27.

-- 1. Rename the enum type.
ALTER TYPE "OrganizationStatus" RENAME TO "AccountStatus";

-- 2. Rename the primary table.
ALTER TABLE "Organization" RENAME TO "Account";

-- 3. Rename the Organization table's primary-key constraint and unique slug index.
ALTER TABLE "Account" RENAME CONSTRAINT "Organization_pkey" TO "Account_pkey";
ALTER INDEX "Organization_slug_key" RENAME TO "Account_slug_key";

-- 4. Rename the organization_id column and its index on every dependent table.
ALTER TABLE "User" RENAME COLUMN "organization_id" TO "account_id";
ALTER INDEX "User_organization_id_idx" RENAME TO "User_account_id_idx";

ALTER TABLE "Contact" RENAME COLUMN "organization_id" TO "account_id";
ALTER INDEX "Contact_organization_id_idx" RENAME TO "Contact_account_id_idx";

ALTER TABLE "Call" RENAME COLUMN "organization_id" TO "account_id";
ALTER INDEX "Call_organization_id_idx" RENAME TO "Call_account_id_idx";

ALTER TABLE "LeadEvent" RENAME COLUMN "organization_id" TO "account_id";
ALTER INDEX "LeadEvent_organization_id_idx" RENAME TO "LeadEvent_account_id_idx";

ALTER TABLE "Booking" RENAME COLUMN "organization_id" TO "account_id";
ALTER INDEX "Booking_organization_id_idx" RENAME TO "Booking_account_id_idx";

ALTER TABLE "QuoteRequest" RENAME COLUMN "organization_id" TO "account_id";
ALTER INDEX "QuoteRequest_organization_id_idx" RENAME TO "QuoteRequest_account_id_idx";

ALTER TABLE "Automation" RENAME COLUMN "organization_id" TO "account_id";
ALTER INDEX "Automation_organization_id_idx" RENAME TO "Automation_account_id_idx";

ALTER TABLE "Notification" RENAME COLUMN "organization_id" TO "account_id";
ALTER INDEX "Notification_organization_id_idx" RENAME TO "Notification_account_id_idx";

ALTER TABLE "RevenueMetrics" RENAME COLUMN "organization_id" TO "account_id";
ALTER INDEX "RevenueMetrics_organization_id_idx" RENAME TO "RevenueMetrics_account_id_idx";
ALTER INDEX "RevenueMetrics_organization_id_period_start_period_end_key"
  RENAME TO "RevenueMetrics_account_id_period_start_period_end_key";

ALTER TABLE "AssessmentReport" RENAME COLUMN "organization_id" TO "account_id";
ALTER INDEX "AssessmentReport_organization_id_idx" RENAME TO "AssessmentReport_account_id_idx";

ALTER TABLE "Engagement" RENAME COLUMN "organization_id" TO "account_id";
ALTER INDEX "Engagement_organization_id_idx" RENAME TO "Engagement_account_id_idx";

ALTER TABLE "AuditLog" RENAME COLUMN "organization_id" TO "account_id";
ALTER INDEX "AuditLog_organization_id_idx" RENAME TO "AuditLog_account_id_idx";

ALTER TABLE "WebhookEvent" RENAME COLUMN "organization_id" TO "account_id";
ALTER INDEX "WebhookEvent_organization_id_idx" RENAME TO "WebhookEvent_account_id_idx";
