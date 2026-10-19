ALTER TABLE "CallCaptureSession" ADD COLUMN "withdrawal_received_at" TIMESTAMP(3);
ALTER TABLE "CallConsentEvent"
  ADD COLUMN "recorded_at" TIMESTAMP(3),
  ADD COLUMN "source_occurred_at" TIMESTAMP(3),
  ADD COLUMN "source_time_claim" TEXT,
  ADD COLUMN "source_time_status" TEXT,
  ADD COLUMN "source_time_reason" TEXT,
  ADD COLUMN "source_provenance" TEXT,
  ADD COLUMN "request_hash" TEXT,
  ADD COLUMN "review_activity_json" JSONB;

CREATE FUNCTION "guard_withdrawal_receipt"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."withdrawal_received_at" IS NOT NULL THEN
    NEW."withdrawal_received_at" := OLD."withdrawal_received_at";
    IF NEW."control_state" IN ('START_PENDING', 'AI_ACTIVE', 'CONSENT_PENDING_OPERATOR', 'AWAITING_DTMF') THEN
      RAISE EXCEPTION 'withdrawal_is_terminal';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "CallCaptureSession_withdrawal_terminal" BEFORE UPDATE ON "CallCaptureSession"
FOR EACH ROW EXECUTE FUNCTION "guard_withdrawal_receipt"();
