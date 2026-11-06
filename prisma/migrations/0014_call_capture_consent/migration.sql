CREATE TABLE "CallCaptureConsent" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "call_id" TEXT NOT NULL,
    "provider_call_id" TEXT NOT NULL,
    "state_json" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CallCaptureConsent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CallCaptureConsent_account_id_provider_call_id_key" ON "CallCaptureConsent"("account_id", "provider_call_id");
CREATE UNIQUE INDEX "CallCaptureConsent_account_id_call_id_key" ON "CallCaptureConsent"("account_id", "call_id");
CREATE INDEX "CallCaptureConsent_account_id_idx" ON "CallCaptureConsent"("account_id");
