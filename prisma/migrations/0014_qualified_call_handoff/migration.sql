ALTER TABLE "Notification" ADD COLUMN "dedupe_key" TEXT;
CREATE UNIQUE INDEX "Notification_dedupe_key_key" ON "Notification"("dedupe_key");

CREATE TABLE "QualifiedCallHandoff" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "call_id" TEXT NOT NULL,
    "lead_event_id" TEXT NOT NULL,
    "operation_key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "provider" TEXT NOT NULL,
    "config_snapshot_id" TEXT,
    "config_hash" TEXT,
    "provider_task_id" TEXT,
    "notification_id" TEXT,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "last_error_code" TEXT,
    "queued_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "QualifiedCallHandoff_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "QualifiedCallHandoff_operation_key_key" ON "QualifiedCallHandoff"("operation_key");
CREATE INDEX "QualifiedCallHandoff_account_id_status_idx" ON "QualifiedCallHandoff"("account_id", "status");
CREATE INDEX "QualifiedCallHandoff_account_id_call_id_idx" ON "QualifiedCallHandoff"("account_id", "call_id");
