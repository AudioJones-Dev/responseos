BEGIN;
CREATE UNIQUE INDEX "FrlWebIntake_account_id_id_key" ON "FrlWebIntake"("account_id", "id");
CREATE TABLE "FrlMockDelivery" (
  "id" TEXT NOT NULL,
  "account_id" TEXT NOT NULL,
  "intake_id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "mode" TEXT NOT NULL DEFAULT 'mock',
  "status" TEXT NOT NULL DEFAULT 'blocked',
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "dispatch_token" TEXT,
  "lease_until" TIMESTAMP(3),
  "receipt_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FrlMockDelivery_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FrlMockDelivery_mode_check" CHECK ("mode" = 'mock'),
  CONSTRAINT "FrlMockDelivery_kind_check" CHECK ("kind" IN ('crm', 'notification', 'marketing')),
  CONSTRAINT "FrlMockDelivery_status_check" CHECK ("status" IN ('blocked', 'dispatching', 'confirmed', 'rejected', 'uncertain')),
  CONSTRAINT "FrlMockDelivery_attempt_check" CHECK ("attempt_count" BETWEEN 0 AND 3),
  CONSTRAINT "FrlMockDelivery_dispatch_check" CHECK (("status" = 'dispatching' AND "dispatch_token" IS NOT NULL AND "lease_until" IS NOT NULL) OR ("status" <> 'dispatching' AND "dispatch_token" IS NULL AND "lease_until" IS NULL)),
  CONSTRAINT "FrlMockDelivery_receipt_check" CHECK (("status" = 'confirmed') = ("receipt_id" IS NOT NULL))
);
CREATE UNIQUE INDEX "FrlMockDelivery_account_id_intake_id_kind_key" ON "FrlMockDelivery"("account_id", "intake_id", "kind");
CREATE INDEX "FrlMockDelivery_account_id_status_idx" ON "FrlMockDelivery"("account_id", "status");
ALTER TABLE "FrlMockDelivery" ADD CONSTRAINT "FrlMockDelivery_account_id_intake_id_fkey" FOREIGN KEY ("account_id", "intake_id") REFERENCES "FrlWebIntake"("account_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
COMMIT;
