-- Canonical provider identities must be idempotent within a tenant.
CREATE UNIQUE INDEX "Call_account_id_provider_provider_call_id_key"
ON "Call"("account_id", "provider", "provider_call_id");

CREATE UNIQUE INDEX "WebhookEvent_provider_provider_event_id_key"
ON "WebhookEvent"("provider", "provider_event_id");

ALTER TABLE "Contact"
ADD COLUMN "email_verified" BOOLEAN NOT NULL DEFAULT false;

CREATE TYPE "ProspectIntakeStatus" AS ENUM (
  'received',
  'reviewed',
  'qualified',
  'rejected'
);

CREATE TYPE "ProspectNotificationStatus" AS ENUM (
  'pending',
  'sent',
  'failed'
);

CREATE TYPE "CrmSyncOperationStatus" AS ENUM (
  'pending',
  'processing',
  'succeeded',
  'retryable_failed',
  'review_required',
  'cancelled'
);

CREATE TABLE "ProspectIntake" (
  "id" TEXT NOT NULL,
  "account_id" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "payload_hash" TEXT NOT NULL,
  "request_json" JSONB,
  "status" "ProspectIntakeStatus" NOT NULL DEFAULT 'received',
  "notification_status" "ProspectNotificationStatus" NOT NULL DEFAULT 'pending',
  "notification_error" TEXT,
  "reviewed_by" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "expires_at" TIMESTAMP(3) NOT NULL,
  "purged_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProspectIntake_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProspectIntake_reference_key"
ON "ProspectIntake"("reference");
CREATE UNIQUE INDEX "ProspectIntake_account_id_idempotency_key_key"
ON "ProspectIntake"("account_id", "idempotency_key");
CREATE INDEX "ProspectIntake_account_id_status_idx"
ON "ProspectIntake"("account_id", "status");
CREATE INDEX "ProspectIntake_expires_at_idx"
ON "ProspectIntake"("expires_at");
CREATE INDEX "ProspectIntake_created_at_idx"
ON "ProspectIntake"("created_at");

CREATE TABLE "CrmSyncOperation" (
  "id" TEXT NOT NULL,
  "account_id" TEXT NOT NULL,
  "operation_key" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "call_id" TEXT NOT NULL,
  "source_webhook_id" TEXT,
  "status" "CrmSyncOperationStatus" NOT NULL DEFAULT 'pending',
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "provider_contact_id" TEXT,
  "provider_activity_id" TEXT,
  "provider_task_id" TEXT,
  "last_error_code" TEXT,
  "last_error_redacted" TEXT,
  "next_attempt_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CrmSyncOperation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CrmSyncOperation_operation_key_key"
ON "CrmSyncOperation"("operation_key");
CREATE INDEX "CrmSyncOperation_account_id_status_idx"
ON "CrmSyncOperation"("account_id", "status");
CREATE INDEX "CrmSyncOperation_call_id_idx"
ON "CrmSyncOperation"("call_id");
CREATE INDEX "CrmSyncOperation_source_webhook_id_idx"
ON "CrmSyncOperation"("source_webhook_id");
