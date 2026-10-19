ALTER TABLE "CallCaptureSession" ADD COLUMN "call_disconnected_at" TIMESTAMP(3);

CREATE FUNCTION "guard_call_disconnection"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."call_disconnected_at" IS NOT NULL AND NEW."call_disconnected_at" IS DISTINCT FROM OLD."call_disconnected_at" THEN
    RAISE EXCEPTION 'call_disconnection_is_permanent';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "CallCaptureSession_disconnection_permanent" BEFORE UPDATE ON "CallCaptureSession"
FOR EACH ROW EXECUTE FUNCTION "guard_call_disconnection"();
