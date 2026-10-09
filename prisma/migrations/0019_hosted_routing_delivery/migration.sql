BEGIN;
CREATE TABLE "HostedRoutingDelivery" (
  "id" TEXT NOT NULL,
  "account_id" TEXT NOT NULL,
  "intake_id" TEXT NOT NULL,
  "manifest_version" TEXT NOT NULL,
  "mode" TEXT NOT NULL DEFAULT 'simulated',
  "status" TEXT NOT NULL DEFAULT 'queued',
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "dispatch_token" TEXT,
  "lease_until" TIMESTAMP(3),
  "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "checkpoint_json" JSONB NOT NULL DEFAULT '{}',
  "last_error_code" TEXT,
  "confirmed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HostedRoutingDelivery_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HostedRoutingDelivery_scope_fk" FOREIGN KEY ("account_id", "intake_id") REFERENCES "FrlWebIntake"("account_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "HostedRoutingDelivery_mode_check" CHECK ("mode" IN ('simulated', 'hubspot')),
  CONSTRAINT "HostedRoutingDelivery_status_check" CHECK ("status" IN ('queued', 'dispatching', 'confirmed', 'rejected', 'uncertain')),
  CONSTRAINT "HostedRoutingDelivery_attempt_check" CHECK ("attempt_count" BETWEEN 0 AND 5),
  CONSTRAINT "HostedRoutingDelivery_fence_check" CHECK (("status" = 'dispatching' AND "dispatch_token" IS NOT NULL AND "lease_until" IS NOT NULL) OR ("status" <> 'dispatching' AND "dispatch_token" IS NULL AND "lease_until" IS NULL)),
  CONSTRAINT "HostedRoutingDelivery_confirmation_check" CHECK (("status" = 'confirmed') = ("confirmed_at" IS NOT NULL))
);
CREATE UNIQUE INDEX "HostedRoutingDelivery_account_id_intake_id_key" ON "HostedRoutingDelivery"("account_id", "intake_id");
CREATE INDEX "HostedRoutingDelivery_account_id_status_next_attempt_at_idx" ON "HostedRoutingDelivery"("account_id", "status", "next_attempt_at");
COMMIT;
