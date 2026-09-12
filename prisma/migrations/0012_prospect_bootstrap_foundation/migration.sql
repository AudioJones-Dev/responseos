CREATE TYPE "ProspectBootstrapStatus" AS ENUM (
  'draft', 'ingesting', 'review_required', 'approved', 'provisioning',
  'ready', 'active', 'completed', 'promotion_pending', 'converted',
  'expired', 'cleanup_pending', 'cleaned', 'failed'
);

CREATE TYPE "KnowledgeIngestionStatus" AS ENUM ('pending', 'running', 'completed', 'failed');
CREATE TYPE "KnowledgeSourceType" AS ENUM ('website_page', 'manual_reference');
CREATE TYPE "KnowledgeSourceStatus" AS ENUM ('pending', 'acquired', 'blocked', 'failed', 'purged');
CREATE TYPE "KnowledgeFactStatus" AS ENUM (
  'source_observed', 'cross_source_confirmed', 'operator_approved_for_demo',
  'owner_confirmed', 'conflicted', 'rejected'
);
CREATE TYPE "BusinessMemorySnapshotStatus" AS ENUM ('draft', 'approved', 'revoked');
CREATE TYPE "TelephonyNumberStatus" AS ENUM ('available', 'assigned', 'quarantined', 'released', 'error');
CREATE TYPE "TelephonyNumberAssignmentStatus" AS ENUM ('assigned', 'active', 'quarantined', 'released');
CREATE TYPE "BootstrapPromotionStatus" AS ENUM ('draft', 'exported', 'imported', 'cancelled');

ALTER TABLE "WebhookEvent"
ADD COLUMN "payload_expires_at" TIMESTAMP(3),
ADD COLUMN "payload_purged_at" TIMESTAMP(3);
CREATE INDEX "WebhookEvent_payload_expires_at_idx" ON "WebhookEvent"("payload_expires_at");

CREATE TABLE "ProspectBootstrap" (
  "id" TEXT NOT NULL,
  "account_id" TEXT NOT NULL,
  "prospect_intake_id" TEXT,
  "canonical_website" TEXT NOT NULL,
  "status" "ProspectBootstrapStatus" NOT NULL DEFAULT 'draft',
  "active_account_key" TEXT,
  "current_memory_snapshot_id" TEXT,
  "active_assignment_id" TEXT,
  "approved_by" TEXT,
  "approved_at" TIMESTAMP(3),
  "activated_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "expires_at" TIMESTAMP(3),
  "content_expires_at" TIMESTAMP(3),
  "content_purged_at" TIMESTAMP(3),
  "cleanup_completed_at" TIMESTAMP(3),
  "promotion_correlation_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProspectBootstrap_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgeIngestionRun" (
  "id" TEXT NOT NULL,
  "account_id" TEXT NOT NULL,
  "bootstrap_id" TEXT NOT NULL,
  "status" "KnowledgeIngestionStatus" NOT NULL DEFAULT 'pending',
  "extractor_version" TEXT NOT NULL,
  "template_version" TEXT NOT NULL,
  "source_count" INTEGER NOT NULL DEFAULT 0,
  "fact_count" INTEGER NOT NULL DEFAULT 0,
  "conflict_count" INTEGER NOT NULL DEFAULT 0,
  "error_code" TEXT,
  "error_redacted" TEXT,
  "started_at" TIMESTAMP(3),
  "ended_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KnowledgeIngestionRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgeSource" (
  "id" TEXT NOT NULL,
  "account_id" TEXT NOT NULL,
  "bootstrap_id" TEXT NOT NULL,
  "ingestion_run_id" TEXT,
  "source_type" "KnowledgeSourceType" NOT NULL,
  "url" TEXT NOT NULL,
  "normalized_url" TEXT NOT NULL,
  "status" "KnowledgeSourceStatus" NOT NULL DEFAULT 'pending',
  "robots_decision" TEXT,
  "http_status" INTEGER,
  "content_type" TEXT,
  "content_hash" TEXT,
  "extracted_text" TEXT,
  "fetched_at" TIMESTAMP(3),
  "expires_at" TIMESTAMP(3),
  "purged_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KnowledgeSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgeFact" (
  "id" TEXT NOT NULL,
  "account_id" TEXT NOT NULL,
  "bootstrap_id" TEXT NOT NULL,
  "source_id" TEXT NOT NULL,
  "source_ids_json" JSONB NOT NULL,
  "fact_key" TEXT NOT NULL,
  "value_json" JSONB NOT NULL,
  "evidence_excerpt" TEXT NOT NULL,
  "status" "KnowledgeFactStatus" NOT NULL DEFAULT 'source_observed',
  "confidence" DOUBLE PRECISION,
  "conflict_group" TEXT,
  "valid_as_of" TIMESTAMP(3),
  "reviewed_by" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "expires_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KnowledgeFact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BusinessMemorySnapshot" (
  "id" TEXT NOT NULL,
  "account_id" TEXT NOT NULL,
  "bootstrap_id" TEXT,
  "promotion_correlation_id" TEXT,
  "schema_version" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "memory_json" JSONB NOT NULL,
  "content_hash" TEXT NOT NULL,
  "template_version" TEXT NOT NULL,
  "status" "BusinessMemorySnapshotStatus" NOT NULL DEFAULT 'draft',
  "approved_by" TEXT,
  "approved_at" TIMESTAMP(3),
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BusinessMemorySnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TelephonyNumber" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "provider_number_id" TEXT NOT NULL,
  "e164" TEXT NOT NULL,
  "capabilities_json" JSONB,
  "status" "TelephonyNumberStatus" NOT NULL DEFAULT 'available',
  "monthly_cost_micros" INTEGER,
  "deletion_lock_enabled" BOOLEAN NOT NULL DEFAULT true,
  "evergreen" BOOLEAN NOT NULL DEFAULT false,
  "acquired_at" TIMESTAMP(3),
  "released_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TelephonyNumber_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TelephonyNumberAssignment" (
  "id" TEXT NOT NULL,
  "account_id" TEXT NOT NULL,
  "bootstrap_id" TEXT NOT NULL,
  "telephony_number_id" TEXT NOT NULL,
  "provider_assistant_id" TEXT NOT NULL,
  "status" "TelephonyNumberAssignmentStatus" NOT NULL DEFAULT 'assigned',
  "number_exclusivity_key" TEXT,
  "bootstrap_exclusivity_key" TEXT,
  "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "activated_at" TIMESTAMP(3),
  "unassigned_at" TIMESTAMP(3),
  "quarantine_until" TIMESTAMP(3),
  "last_inbound_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TelephonyNumberAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BootstrapPromotion" (
  "id" TEXT NOT NULL,
  "account_id" TEXT NOT NULL,
  "bootstrap_id" TEXT NOT NULL,
  "correlation_id" TEXT NOT NULL,
  "source_snapshot_id" TEXT NOT NULL,
  "source_snapshot_hash" TEXT NOT NULL,
  "manifest_json" JSONB NOT NULL,
  "manifest_hash" TEXT NOT NULL,
  "status" "BootstrapPromotionStatus" NOT NULL DEFAULT 'draft',
  "exported_by" TEXT,
  "exported_at" TIMESTAMP(3),
  "imported_account_ref" TEXT,
  "imported_at" TIMESTAMP(3),
  "cancelled_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BootstrapPromotion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProspectBootstrap_active_account_key_key" ON "ProspectBootstrap"("active_account_key");
CREATE INDEX "ProspectBootstrap_account_id_status_idx" ON "ProspectBootstrap"("account_id", "status");
CREATE INDEX "ProspectBootstrap_expires_at_idx" ON "ProspectBootstrap"("expires_at");
CREATE INDEX "ProspectBootstrap_content_expires_at_idx" ON "ProspectBootstrap"("content_expires_at");
CREATE INDEX "ProspectBootstrap_created_at_idx" ON "ProspectBootstrap"("created_at");
CREATE INDEX "KnowledgeIngestionRun_account_id_bootstrap_id_idx" ON "KnowledgeIngestionRun"("account_id", "bootstrap_id");
CREATE INDEX "KnowledgeIngestionRun_status_created_at_idx" ON "KnowledgeIngestionRun"("status", "created_at");
CREATE UNIQUE INDEX "KnowledgeSource_bootstrap_id_normalized_url_key" ON "KnowledgeSource"("bootstrap_id", "normalized_url");
CREATE INDEX "KnowledgeSource_account_id_bootstrap_id_idx" ON "KnowledgeSource"("account_id", "bootstrap_id");
CREATE INDEX "KnowledgeSource_expires_at_idx" ON "KnowledgeSource"("expires_at");
CREATE INDEX "KnowledgeFact_account_id_bootstrap_id_idx" ON "KnowledgeFact"("account_id", "bootstrap_id");
CREATE INDEX "KnowledgeFact_source_id_idx" ON "KnowledgeFact"("source_id");
CREATE INDEX "KnowledgeFact_fact_key_status_idx" ON "KnowledgeFact"("fact_key", "status");
CREATE UNIQUE INDEX "BusinessMemorySnapshot_bootstrap_id_version_key" ON "BusinessMemorySnapshot"("bootstrap_id", "version");
CREATE UNIQUE INDEX "BusinessMemorySnapshot_bootstrap_id_content_hash_key" ON "BusinessMemorySnapshot"("bootstrap_id", "content_hash");
CREATE UNIQUE INDEX "BusinessMemorySnapshot_promotion_correlation_id_key" ON "BusinessMemorySnapshot"("promotion_correlation_id");
CREATE INDEX "BusinessMemorySnapshot_account_id_bootstrap_id_status_idx" ON "BusinessMemorySnapshot"("account_id", "bootstrap_id", "status");
CREATE UNIQUE INDEX "TelephonyNumber_provider_provider_number_id_key" ON "TelephonyNumber"("provider", "provider_number_id");
CREATE UNIQUE INDEX "TelephonyNumber_provider_e164_key" ON "TelephonyNumber"("provider", "e164");
CREATE INDEX "TelephonyNumber_status_idx" ON "TelephonyNumber"("status");
CREATE UNIQUE INDEX "TelephonyNumberAssignment_number_exclusivity_key_key" ON "TelephonyNumberAssignment"("number_exclusivity_key");
CREATE UNIQUE INDEX "TelephonyNumberAssignment_bootstrap_exclusivity_key_key" ON "TelephonyNumberAssignment"("bootstrap_exclusivity_key");
CREATE INDEX "TelephonyNumberAssignment_account_id_bootstrap_id_idx" ON "TelephonyNumberAssignment"("account_id", "bootstrap_id");
CREATE INDEX "TelephonyNumberAssignment_number_history_idx" ON "TelephonyNumberAssignment"("telephony_number_id", "assigned_at", "unassigned_at");
CREATE INDEX "TelephonyNumberAssignment_status_quarantine_until_idx" ON "TelephonyNumberAssignment"("status", "quarantine_until");
CREATE UNIQUE INDEX "BootstrapPromotion_correlation_id_key" ON "BootstrapPromotion"("correlation_id");
CREATE INDEX "BootstrapPromotion_account_id_bootstrap_id_idx" ON "BootstrapPromotion"("account_id", "bootstrap_id");
CREATE INDEX "BootstrapPromotion_status_created_at_idx" ON "BootstrapPromotion"("status", "created_at");
