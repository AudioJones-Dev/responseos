ALTER TABLE "Call" ADD COLUMN "review_required" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "WebhookEvent" ADD COLUMN "provider_call_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
CREATE INDEX "WebhookEvent_provider_call_ids_idx" ON "WebhookEvent" USING GIN ("provider_call_ids");
CREATE TABLE "CallCaptureSession" (
  "id" TEXT PRIMARY KEY, "account_id" TEXT NOT NULL, "provider_call_id" TEXT NOT NULL,
  "snapshot_id" TEXT NOT NULL, "snapshot_json" JSONB NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "CallCaptureSession_account_id_provider_call_id_key" ON "CallCaptureSession"("account_id", "provider_call_id");
CREATE INDEX "CallCaptureSession_account_id_idx" ON "CallCaptureSession"("account_id");
CREATE TABLE "CallConsentEvent" (
  "id" TEXT PRIMARY KEY, "account_id" TEXT NOT NULL, "provider_call_id" TEXT NOT NULL,
  "event_key" TEXT NOT NULL, "action" TEXT NOT NULL, "artifact" TEXT NOT NULL,
  "disclosure_ref" TEXT NOT NULL, "evidence_ref" TEXT NOT NULL,
  "jurisdiction_basis" TEXT NOT NULL, "source_channel" TEXT NOT NULL, "actor_user_id" TEXT NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "CallConsentEvent_event_key_key" ON "CallConsentEvent"("event_key");
CREATE INDEX "CallConsentEvent_account_id_provider_call_id_occurred_at_idx" ON "CallConsentEvent"("account_id", "provider_call_id", "occurred_at");
CREATE TABLE "CallReview" (
  "id" TEXT PRIMARY KEY, "account_id" TEXT NOT NULL, "call_id" TEXT NOT NULL,
  "revision" INTEGER NOT NULL, "source_hash" TEXT NOT NULL, "evidence_json" JSONB NOT NULL, "payload_json" JSONB NOT NULL, "recipient" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending', "reviewer_user_id" TEXT, "reviewed_at" TIMESTAMP(3),
  "crm_status" TEXT NOT NULL DEFAULT 'pending', "email_status" TEXT NOT NULL DEFAULT 'pending',
  "email_message_id" TEXT, "email_attempt_at" TIMESTAMP(3), "dispatch_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "CallReview_account_id_call_id_revision_key" ON "CallReview"("account_id", "call_id", "revision");
CREATE INDEX "CallReview_account_id_status_idx" ON "CallReview"("account_id", "status");
