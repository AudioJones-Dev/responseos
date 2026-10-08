BEGIN;

-- CreateTable
CREATE TABLE "FrlInquiry" (
    "account_id" TEXT NOT NULL,
    "inquiry_id" UUID NOT NULL,
    "pathway" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FrlInquiry_pkey" PRIMARY KEY ("account_id","inquiry_id")
);

-- CreateTable
CREATE TABLE "FrlInquiryEvent" (
    "account_id" TEXT NOT NULL,
    "event_id" UUID NOT NULL,
    "inquiry_id" UUID NOT NULL,
    "schema_version" INTEGER NOT NULL,
    "event_type" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "source_channel" TEXT NOT NULL,
    "source_event_id" TEXT NOT NULL,
    "correlation_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "content_hash" CHAR(64) NOT NULL,
    "envelope" JSONB NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FrlInquiryEvent_pkey" PRIMARY KEY ("account_id","event_id")
);

-- CreateTable
CREATE TABLE "FrlOutboxOperation" (
    "account_id" TEXT NOT NULL,
    "operation_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "operation_type" TEXT NOT NULL,
    "schema_version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'blocked',
    "blocked_reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FrlOutboxOperation_pkey" PRIMARY KEY ("account_id","operation_id")
);

-- CreateIndex
CREATE INDEX "FrlInquiryEvent_account_id_correlation_id_idx" ON "FrlInquiryEvent"("account_id", "correlation_id");

-- CreateIndex
CREATE UNIQUE INDEX "FrlInquiryEvent_account_id_inquiry_id_revision_key" ON "FrlInquiryEvent"("account_id", "inquiry_id", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "FrlInquiryEvent_account_id_source_channel_source_event_id_e_key" ON "FrlInquiryEvent"("account_id", "source_channel", "source_event_id", "event_type");

-- CreateIndex
CREATE INDEX "FrlOutboxOperation_account_id_status_idx" ON "FrlOutboxOperation"("account_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FrlOutboxOperation_account_id_event_id_operation_type_key" ON "FrlOutboxOperation"("account_id", "event_id", "operation_type");

-- AddForeignKey
ALTER TABLE "FrlInquiry" ADD CONSTRAINT "FrlInquiry_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "FrlInquiryEvent" ADD CONSTRAINT "FrlInquiryEvent_account_id_inquiry_id_fkey" FOREIGN KEY ("account_id", "inquiry_id") REFERENCES "FrlInquiry"("account_id", "inquiry_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "FrlOutboxOperation" ADD CONSTRAINT "FrlOutboxOperation_account_id_event_id_fkey" FOREIGN KEY ("account_id", "event_id") REFERENCES "FrlInquiryEvent"("account_id", "event_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "FrlInquiry" ADD CONSTRAINT "FrlInquiry_revision_check" CHECK (revision > 0);
ALTER TABLE "FrlInquiry" ADD CONSTRAINT "FrlInquiry_pathway_check" CHECK (pathway IN ('residential', 'builder', 'architect', 'commercial', 'repair', 'equipment_acquisition'));
ALTER TABLE "FrlInquiryEvent" ADD CONSTRAINT "FrlInquiryEvent_version_check" CHECK (schema_version = 2 AND revision > 0);
ALTER TABLE "FrlInquiryEvent" ADD CONSTRAINT "FrlInquiryEvent_type_check" CHECK (event_type IN ('inbound_received', 'context_recorded'));
ALTER TABLE "FrlInquiryEvent" ADD CONSTRAINT "FrlInquiryEvent_channel_check" CHECK (source_channel IN ('form', 'call', 'email'));
ALTER TABLE "FrlOutboxOperation" ADD CONSTRAINT "FrlOutboxOperation_disabled_check" CHECK (
  status = 'blocked' AND blocked_reason IN ('commissioning_not_accepted', 'acquisition_not_authorized')
  AND schema_version = 1 AND operation_type = 'crm_projection_requested'
);

CREATE FUNCTION frl_reject_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'frl_event_history_is_immutable' USING ERRCODE = '55000';
END;
$$;
CREATE TRIGGER frl_event_immutable BEFORE UPDATE OR DELETE ON "FrlInquiryEvent"
FOR EACH ROW EXECUTE FUNCTION frl_reject_event_mutation();

COMMIT;
