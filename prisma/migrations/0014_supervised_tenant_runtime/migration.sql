DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "QuoteRequest"
    WHERE "lead_event_id" IS NOT NULL
    GROUP BY "lead_event_id" HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'QuoteRequest duplicate lead_event_id values block migration 0014'
      USING HINT = 'Preserve and reconcile duplicate quote requests with the operator before retrying this migration. No rows were deleted by this preflight.';
  END IF;
END $$;

-- Supervised tenant runtime (ADR-0056).
--
-- Additive only. Every new column is nullable or carries a default, so existing
-- rows stay valid without a backfill, and the prospect-demo lane is unchanged.

-- CreateEnum
CREATE TYPE "CallerRelationship" AS ENUM ('new_prospect', 'returning_customer', 'contractor', 'vendor', 'other_or_unknown');

-- CreateEnum
CREATE TYPE "InteractionClass" AS ENUM ('new_sales', 'existing_customer_new_sale', 'new_service_request', 'existing_service_request', 'general_admin', 'contractor_vendor', 'human_escalation', 'unknown');

-- CreateEnum
CREATE TYPE "RecordingConsent" AS ENUM ('continued', 'refused', 'unknown');

-- AlterEnum
ALTER TYPE "AgentProfileType" ADD VALUE 'supervised_receptionist';

-- AlterTable
ALTER TABLE "Call" ADD COLUMN     "caller_relationship" "CallerRelationship",
ADD COLUMN     "interaction_class" "InteractionClass",
ADD COLUMN     "recording_consent" "RecordingConsent";

-- AlterTable
ALTER TABLE "QuoteRequest" ADD COLUMN     "photos_requested" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "attempt_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "call_id" TEXT,
ADD COLUMN     "dedupe_key" TEXT,
ADD COLUMN     "event" TEXT,
ADD COLUMN     "last_error_code" TEXT,
ADD COLUMN     "next_attempt_at" TIMESTAMP(3),
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "provider_message_id" TEXT;

-- AlterTable
ALTER TABLE "WebhookEvent" ADD COLUMN     "agent_target" TEXT,
ADD COLUMN     "provider_call_id" TEXT;

-- AlterTable
ALTER TABLE "TelephonyNumberAssignment" ALTER COLUMN "bootstrap_id" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "QuoteRequest_lead_event_id_key" ON "QuoteRequest"("lead_event_id");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupe_key_key" ON "Notification"("dedupe_key");

-- CreateIndex
CREATE INDEX "Notification_call_id_idx" ON "Notification"("call_id");

-- CreateIndex
CREATE INDEX "Notification_status_idx" ON "Notification"("status");

-- CreateIndex
CREATE INDEX "WebhookEvent_provider_provider_call_id_idx" ON "WebhookEvent"("provider", "provider_call_id");
