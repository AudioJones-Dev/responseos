-- Local-only additive candidate. No historical body can establish identity.
ALTER TABLE "WebhookEvent"
  ADD COLUMN "content_fingerprint" CHAR(64),
  ADD COLUMN "fingerprint_version" SMALLINT,
  ADD COLUMN "fingerprint_key_id" VARCHAR(64);

ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_fingerprint_tuple_check" CHECK (
  ("content_fingerprint" IS NULL AND "fingerprint_version" IS NULL AND "fingerprint_key_id" IS NULL)
  OR
  ("content_fingerprint" IS NOT NULL AND "fingerprint_version" IS NOT NULL AND "fingerprint_key_id" IS NOT NULL
    AND "content_fingerprint"::text ~ '^[0-9a-f]{64}$'
    AND "fingerprint_version" = 1
    AND "fingerprint_key_id" ~ '^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$'
    AND "signature_valid" AND "payload_expires_at" IS NOT NULL AND isfinite("payload_expires_at") AND "payload_purged_at" IS NULL)
);

CREATE FUNCTION "guard_webhook_fingerprint"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."content_fingerprint" IS NOT NULL AND NEW."payload_expires_at" <= clock_timestamp() THEN
      RAISE EXCEPTION 'webhook_fingerprint_expired' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD."content_fingerprint" IS NOT NULL THEN
    IF ROW(NEW."provider", NEW."provider_event_id", NEW."dedupe_hash")
       IS DISTINCT FROM ROW(OLD."provider", OLD."provider_event_id", OLD."dedupe_hash") THEN
      RAISE EXCEPTION 'webhook_fingerprint_identity_immutable' USING ERRCODE = '23514';
    END IF;
    IF NEW."payload_expires_at" IS NULL OR NEW."payload_expires_at" > OLD."payload_expires_at" THEN
      RAISE EXCEPTION 'webhook_fingerprint_expiry_extension' USING ERRCODE = '23514';
    END IF;
    IF NEW."payload_purged_at" IS NOT NULL THEN
      IF OLD."payload_expires_at" > clock_timestamp()
         OR NEW."payload_purged_at" < OLD."payload_expires_at"
         OR NEW."payload_purged_at" > clock_timestamp() THEN
        RAISE EXCEPTION 'webhook_fingerprint_premature_erasure' USING ERRCODE = '23514';
      END IF;
      -- The existing retention writer need not know these additive columns.
      NEW."content_fingerprint" := NULL;
      NEW."fingerprint_version" := NULL;
      NEW."fingerprint_key_id" := NULL;
      RETURN NEW;
    END IF;
  END IF;

  IF ROW(NEW."content_fingerprint", NEW."fingerprint_version", NEW."fingerprint_key_id")
     IS DISTINCT FROM ROW(OLD."content_fingerprint", OLD."fingerprint_version", OLD."fingerprint_key_id") THEN
    RAISE EXCEPTION 'webhook_fingerprint_immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "WebhookEvent_fingerprint_guard"
BEFORE INSERT OR UPDATE ON "WebhookEvent"
FOR EACH ROW EXECUTE FUNCTION "guard_webhook_fingerprint"();
