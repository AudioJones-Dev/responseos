CREATE TABLE "QualifiedNotificationDelivery" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "call_id" TEXT NOT NULL,
    "handoff_id" TEXT NOT NULL,
    "notification_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "provider" TEXT NOT NULL DEFAULT 'resend',
    "payload_hash" TEXT,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "first_attempt_at" TIMESTAMP(3),
    "claim_token" TEXT,
    "lease_expires_at" TIMESTAMP(3),
    "provider_message_id" TEXT,
    "provider_last_event" TEXT,
    "provider_task_id" TEXT,
    "verified_owner_id" TEXT,
    "owner_verified_at" TIMESTAMP(3),
    "accepted_at" TIMESTAMP(3),
    "delivery_observed_at" TIMESTAMP(3),
    "last_checked_at" TIMESTAMP(3),
    "last_error_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "QualifiedNotificationDelivery_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "QualifiedNotificationDelivery_handoff_id_key" ON "QualifiedNotificationDelivery"("handoff_id");
CREATE UNIQUE INDEX "QualifiedNotificationDelivery_notification_id_key" ON "QualifiedNotificationDelivery"("notification_id");
CREATE INDEX "QualifiedNotificationDelivery_account_id_status_idx" ON "QualifiedNotificationDelivery"("account_id", "status");
CREATE INDEX "QualifiedNotificationDelivery_account_id_call_id_idx" ON "QualifiedNotificationDelivery"("account_id", "call_id");
