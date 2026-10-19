ALTER TABLE "CallCaptureSession" ADD COLUMN "withdrawal_drained_at" TIMESTAMP(3);
CREATE UNIQUE INDEX "CallCaptureSession_id_account_id_provider_call_id_key" ON "CallCaptureSession"("id", "account_id", "provider_call_id");

CREATE TABLE "CallWithdrawalReceipt" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "account_id" TEXT NOT NULL,
  "capture_id" TEXT NOT NULL,
  "provider_call_id" TEXT NOT NULL,
  "generation" INTEGER NOT NULL,
  "actor_user_id" TEXT,
  "event_key" TEXT,
  "request_hash" TEXT,
  "source_time_claim" TEXT,
  "source_provenance" TEXT NOT NULL,
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT date_trunc('milliseconds', clock_timestamp() AT TIME ZONE 'UTC'),
  CONSTRAINT "CallWithdrawalReceipt_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "withdrawal_receipt_capture_fkey" FOREIGN KEY ("capture_id", "account_id", "provider_call_id") REFERENCES "CallCaptureSession"("id", "account_id", "provider_call_id") ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE UNIQUE INDEX "CallWithdrawalReceipt_account_id_provider_call_id_key" ON "CallWithdrawalReceipt"("account_id", "provider_call_id");

INSERT INTO "CallWithdrawalReceipt" ("id", "account_id", "capture_id", "provider_call_id", "generation", "source_provenance", "received_at")
SELECT 'legacy:' || "id", "account_id", "id", "provider_call_id", "generation", 'legacy_capture_receipt', "withdrawal_received_at"
FROM "CallCaptureSession" WHERE "withdrawal_received_at" IS NOT NULL;

CREATE FUNCTION guard_independent_withdrawal_receipt() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  RAISE EXCEPTION 'withdrawal_receipt_is_insert_only' USING ERRCODE = '23514';
END $$;
CREATE TRIGGER independent_withdrawal_receipt_immutable BEFORE UPDATE OR DELETE ON "CallWithdrawalReceipt"
FOR EACH ROW EXECUTE FUNCTION guard_independent_withdrawal_receipt();
REVOKE UPDATE, DELETE ON "CallWithdrawalReceipt" FROM PUBLIC;

CREATE FUNCTION guard_withdrawal_drain() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF ROW(NEW.id, NEW.account_id, NEW.provider_call_id) IS DISTINCT FROM ROW(OLD.id, OLD.account_id, OLD.provider_call_id) THEN
    RAISE EXCEPTION 'capture_identity_is_immutable' USING ERRCODE = '23514';
  END IF;
  IF OLD.withdrawal_drained_at IS NOT NULL AND NEW.withdrawal_drained_at IS DISTINCT FROM OLD.withdrawal_drained_at THEN
    RAISE EXCEPTION 'withdrawal_drain_is_permanent' USING ERRCODE = '23514';
  END IF;
  IF OLD.withdrawal_drained_at IS NULL AND NEW.withdrawal_drained_at IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('capture:' || NEW.account_id || ':' || NEW.provider_call_id));
    IF NEW.withdrawal_received_at IS NULL OR NEW.content_admission_closed_at IS NULL OR NOT EXISTS (
      SELECT 1 FROM public."CallWithdrawalReceipt" r WHERE r.account_id=NEW.account_id AND r.capture_id=NEW.id AND r.provider_call_id=NEW.provider_call_id
    ) THEN RAISE EXCEPTION 'withdrawal_drain_requires_receipt_and_closure' USING ERRCODE = '23514'; END IF;
    NEW.withdrawal_drained_at := date_trunc('milliseconds', clock_timestamp() AT TIME ZONE 'UTC');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER withdrawal_drain_guard BEFORE UPDATE ON "CallCaptureSession" FOR EACH ROW EXECUTE FUNCTION guard_withdrawal_drain();
