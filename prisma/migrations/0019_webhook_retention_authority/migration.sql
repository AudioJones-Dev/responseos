ALTER TABLE "WebhookEvent" ADD COLUMN "payload_erasure_required_at" TIMESTAMP(3);

CREATE TABLE "WebhookErasureAudit" (
  "webhook_event_id" TEXT PRIMARY KEY,
  "account_id" TEXT,
  "authorization_reference" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "database_actor" TEXT NOT NULL,
  "erased_at" TIMESTAMP(3) NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "transaction_id" BIGINT NOT NULL
);
REVOKE ALL ON TABLE "WebhookErasureAudit" FROM PUBLIC;

CREATE OR REPLACE FUNCTION "guard_webhook_fingerprint"() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."content_fingerprint" IS NOT NULL AND OLD."payload_expires_at" > clock_timestamp() THEN
      RAISE EXCEPTION 'webhook_fingerprint_premature_deletion' USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW."content_fingerprint" IS NOT NULL AND NEW."payload_expires_at" <= clock_timestamp() THEN
      RAISE EXCEPTION 'webhook_fingerprint_expired' USING ERRCODE = '23514';
    END IF;
    IF NEW."payload_erasure_required_at" IS NOT NULL THEN
      RAISE EXCEPTION 'webhook_erasure_invalid_insert' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD."payload_purged_at" IS NOT NULL THEN
    NEW."payload_purged_at" := OLD."payload_purged_at";
    NEW."raw_body" := '<PURGED_WEBHOOK_PAYLOAD>';
    NEW."signature_header" := NULL;
    NEW."provider_call_id" := NULL;
    NEW."provider_call_ids" := ARRAY[]::text[];
    NEW."agent_target" := NULL;
    NEW."process_error" := CASE WHEN NEW."process_error" IN ('prospect_content_cleaned', 'call_content_purged', 'webhook_authorized_erasure') THEN NEW."process_error" ELSE NULL END;
  END IF;
  IF OLD."payload_erasure_required_at" IS NOT NULL AND
     (NEW."payload_erasure_required_at" IS NULL OR NEW."payload_erasure_required_at" > OLD."payload_erasure_required_at") THEN
    RAISE EXCEPTION 'webhook_erasure_request_immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW."payload_erasure_required_at" IS NOT NULL THEN
    IF NOT isfinite(NEW."payload_erasure_required_at") OR NEW."payload_erasure_required_at" >= NEW."payload_expires_at" THEN
      RAISE EXCEPTION 'webhook_erasure_invalid_deadline' USING ERRCODE = '23514';
    END IF;
    NEW."raw_body" := '<ERASURE_REQUIRED>';
    NEW."signature_header" := NULL;
    NEW."process_error" := 'webhook_erasure_required';
    NEW."provider_call_id" := NULL;
    NEW."provider_call_ids" := ARRAY[]::text[];
    NEW."agent_target" := NULL;
  END IF;
  IF OLD."content_fingerprint" IS NOT NULL THEN
    IF ROW(NEW."provider", NEW."provider_event_id", NEW."dedupe_hash") IS DISTINCT FROM
       ROW(OLD."provider", OLD."provider_event_id", OLD."dedupe_hash") THEN
      RAISE EXCEPTION 'webhook_fingerprint_identity_immutable' USING ERRCODE = '23514';
    END IF;
    IF NEW."payload_expires_at" IS DISTINCT FROM OLD."payload_expires_at" THEN
      RAISE EXCEPTION 'webhook_fingerprint_expiry_immutable' USING ERRCODE = '23514';
    END IF;
    IF NEW."payload_purged_at" IS NOT NULL THEN
      IF NEW."payload_purged_at" > clock_timestamp() OR
         (NEW."payload_purged_at" < OLD."payload_expires_at" AND NOT EXISTS (
           SELECT 1 FROM public."WebhookErasureAudit" a WHERE a."webhook_event_id" = OLD.id
             AND a."account_id" IS NOT DISTINCT FROM OLD."account_id"
             AND a."transaction_id" = txid_current()
             AND a."erased_at" = NEW."payload_purged_at"
         )) THEN
        RAISE EXCEPTION 'webhook_fingerprint_premature_erasure' USING ERRCODE = '23514';
      END IF;
      NEW."content_fingerprint" := NULL;
      NEW."fingerprint_version" := NULL;
      NEW."fingerprint_key_id" := NULL;
      RETURN NEW;
    END IF;
  END IF;
  IF ROW(NEW."content_fingerprint", NEW."fingerprint_version", NEW."fingerprint_key_id") IS DISTINCT FROM
     ROW(OLD."content_fingerprint", OLD."fingerprint_version", OLD."fingerprint_key_id") THEN
    RAISE EXCEPTION 'webhook_fingerprint_immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "WebhookEvent_fingerprint_delete_guard" BEFORE DELETE ON "WebhookEvent"
FOR EACH ROW EXECUTE FUNCTION "guard_webhook_fingerprint"();

CREATE FUNCTION "erase_webhook_early"(event_id TEXT, expected_account_id TEXT, authorization_reference TEXT, reason TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  target public."WebhookEvent"%ROWTYPE;
  erased TIMESTAMP(3);
BEGIN
  IF authorization_reference IS NULL OR authorization_reference !~ '^[A-Za-z0-9][A-Za-z0-9_.:/-]{2,127}$'
     OR reason NOT IN ('retention_deadline', 'authorized_deletion', 'key_compromise') OR reason IS NULL THEN
    RAISE EXCEPTION 'webhook_erasure_authorization_required';
  END IF;
  IF expected_account_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(1380930382, hashtext(expected_account_id));
  END IF;
  SELECT * INTO target FROM public."WebhookEvent" WHERE id = event_id FOR UPDATE;
  IF NOT FOUND OR target."account_id" IS DISTINCT FROM expected_account_id THEN
    RAISE EXCEPTION 'webhook_erasure_target_mismatch';
  END IF;
  IF target."content_fingerprint" IS NULL OR target."payload_purged_at" IS NOT NULL THEN
    RAISE EXCEPTION 'webhook_erasure_unavailable';
  END IF;
  erased := date_trunc('milliseconds', clock_timestamp());
  INSERT INTO public."WebhookErasureAudit" VALUES
    (event_id, expected_account_id, authorization_reference, reason, session_user, erased, target."payload_expires_at", txid_current());
  UPDATE public."WebhookEvent" SET "raw_body" = '<AUTHORIZED_ERASURE>', "signature_header" = NULL,
    "provider_call_id" = NULL, "provider_call_ids" = ARRAY[]::text[], "agent_target" = NULL,
    "process_error" = 'webhook_authorized_erasure', "payload_purged_at" = erased WHERE id = event_id;
END;
$$;
REVOKE ALL ON FUNCTION "erase_webhook_early"(TEXT,TEXT,TEXT,TEXT) FROM PUBLIC;

CREATE FUNCTION "purge_expired_webhook_erasure_audits"() RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE purged INTEGER;
BEGIN
  DELETE FROM public."WebhookErasureAudit" WHERE "expires_at" <= clock_timestamp();
  GET DIAGNOSTICS purged = ROW_COUNT;
  RETURN purged;
END;
$$;
REVOKE ALL ON FUNCTION "purge_expired_webhook_erasure_audits"() FROM PUBLIC;
