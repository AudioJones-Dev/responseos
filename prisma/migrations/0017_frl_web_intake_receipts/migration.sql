BEGIN;
CREATE TABLE "FrlWebIntake" (
  "id" TEXT NOT NULL,
  "account_id" TEXT NOT NULL,
  "environment" TEXT NOT NULL,
  "submission_id" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "payload_hash" TEXT NOT NULL,
  "request_json" JSONB,
  "delivery_status" TEXT NOT NULL DEFAULT 'blocked',
  "expires_at" TIMESTAMP(3) NOT NULL,
  "purged_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FrlWebIntake_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FrlWebIntake_environment_check" CHECK ("environment" IN ('test', 'preview', 'production')),
  CONSTRAINT "FrlWebIntake_delivery_check" CHECK ("delivery_status" = 'blocked')
);
CREATE UNIQUE INDEX "FrlWebIntake_reference_key" ON "FrlWebIntake"("reference");
CREATE UNIQUE INDEX "FrlWebIntake_account_id_environment_submission_id_key" ON "FrlWebIntake"("account_id", "environment", "submission_id");
CREATE INDEX "FrlWebIntake_account_id_delivery_status_idx" ON "FrlWebIntake"("account_id", "delivery_status");
CREATE INDEX "FrlWebIntake_expires_at_idx" ON "FrlWebIntake"("expires_at");
ALTER TABLE "FrlWebIntake" ADD CONSTRAINT "FrlWebIntake_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
COMMIT;
