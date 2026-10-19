CREATE OR REPLACE FUNCTION guard_independent_receipt_state() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF OLD.withdrawal_received_at IS NULL AND NEW.control_state IS DISTINCT FROM OLD.control_state
    AND NEW.control_state IN ('CALL_RECEIVED', 'DISCLOSURE_PLAYING', 'AWAITING_DTMF', 'CONSENT_PENDING_OPERATOR', 'START_PENDING', 'AI_ACTIVE', 'TRANSFER_PENDING')
    AND EXISTS (
      SELECT 1 FROM public."CallWithdrawalReceipt" r
      WHERE r.account_id=OLD.account_id AND r.capture_id=OLD.id AND r.provider_call_id=OLD.provider_call_id
    ) THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END $$;
