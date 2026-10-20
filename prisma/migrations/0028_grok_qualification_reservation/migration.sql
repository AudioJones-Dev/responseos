CREATE TABLE "GrokQualificationReservation" (
 "session_id" TEXT NOT NULL PRIMARY KEY,
 "policy_json" JSONB NOT NULL, "policy_hash" TEXT NOT NULL,
 "admitted_at" TIMESTAMP(3) NOT NULL, "deadline" TIMESTAMP(3) NOT NULL,
 "active_slot" TEXT, "released_at" TIMESTAMP(3),
 CONSTRAINT "GrokQualificationReservation_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "GrokCallSession"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT "qualification_deadline" CHECK ("deadline" > "admitted_at" AND "deadline" <= "admitted_at" + INTERVAL '5 minutes'),
 CONSTRAINT "qualification_slot" CHECK (("active_slot" = 'qualification' AND "released_at" IS NULL) OR ("active_slot" IS NULL AND "released_at" IS NOT NULL))
);
CREATE UNIQUE INDEX "GrokQualificationReservation_active_slot_key" ON "GrokQualificationReservation"("active_slot");
CREATE FUNCTION grok_qualification_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'qualification_is_retained'; END IF;
 IF TG_OP = 'INSERT' THEN
  IF NEW.active_slot IS DISTINCT FROM 'qualification' OR NEW.released_at IS NOT NULL THEN RAISE EXCEPTION 'qualification_slot_required'; END IF;
  RETURN NEW;
 END IF;
 IF ROW(NEW.session_id,NEW.policy_json,NEW.policy_hash,NEW.admitted_at,NEW.deadline) IS DISTINCT FROM ROW(OLD.session_id,OLD.policy_json,OLD.policy_hash,OLD.admitted_at,OLD.deadline)
   OR OLD.released_at IS NOT NULL OR NEW.active_slot IS NOT NULL OR NEW.released_at IS NULL
   OR NOT EXISTS (SELECT 1 FROM public."GrokCallSession" s JOIN public."CallCaptureSession" c ON c.id=s.capture_id AND c.account_id=s.account_id AND c.provider_call_id=s.provider_call_id AND c.generation=s.generation WHERE s.id=OLD.session_id AND c.call_disconnected_at IS NOT NULL AND NEW.released_at >= c.call_disconnected_at)
 THEN RAISE EXCEPTION 'qualification_release_requires_exact_disconnection'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER grok_qualification_guard BEFORE INSERT OR UPDATE OR DELETE ON "GrokQualificationReservation" FOR EACH ROW EXECUTE FUNCTION grok_qualification_guard();
