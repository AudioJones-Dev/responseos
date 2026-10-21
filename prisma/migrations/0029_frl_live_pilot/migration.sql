-- AlterTable
ALTER TABLE "CallCaptureSession" ADD COLUMN     "admission_mode" TEXT NOT NULL DEFAULT 'qualification';

-- CreateTable
CREATE TABLE "GrokTranscriptTurn" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "speaker" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GrokTranscriptTurn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GrokTranscriptTurn_account_id_idx" ON "GrokTranscriptTurn"("account_id");

-- CreateIndex
CREATE INDEX "GrokTranscriptTurn_expires_at_idx" ON "GrokTranscriptTurn"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "GrokTranscriptTurn_session_id_sequence_key" ON "GrokTranscriptTurn"("session_id", "sequence");

-- AddForeignKey
ALTER TABLE "GrokTranscriptTurn" ADD CONSTRAINT "GrokTranscriptTurn_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "GrokCallSession"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;


-- ADR-0082: a capture's admission mode is fixed when the call is admitted.
-- NOT VALID then VALIDATE keeps the scan off the ACCESS EXCLUSIVE lock.
ALTER TABLE "CallCaptureSession" ADD CONSTRAINT "CallCaptureSession_admission_mode_check" CHECK ("admission_mode" IN ('qualification', 'pilot')) NOT VALID;
ALTER TABLE "CallCaptureSession" VALIDATE CONSTRAINT "CallCaptureSession_admission_mode_check";

CREATE FUNCTION call_capture_admission_mode_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF NEW.admission_mode IS DISTINCT FROM OLD.admission_mode THEN RAISE EXCEPTION 'admission_mode_is_immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER call_capture_admission_mode_guard BEFORE UPDATE OF admission_mode ON "CallCaptureSession" FOR EACH ROW EXECUTE FUNCTION call_capture_admission_mode_guard();

CREATE FUNCTION grok_transcript_turn_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP = 'UPDATE' THEN RAISE EXCEPTION 'transcript_turn_is_append_only'; END IF;
 IF NOT EXISTS (
   SELECT 1 FROM public."GrokCallSession" s JOIN public."CallCaptureSession" c ON c.id = s.capture_id AND c.account_id = s.account_id
   WHERE s.id = NEW.session_id AND s.account_id = NEW.account_id AND c.admission_mode = 'pilot'
 ) THEN RAISE EXCEPTION 'transcript_turn_requires_pilot_session'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER grok_transcript_turn_guard BEFORE INSERT OR UPDATE ON "GrokTranscriptTurn" FOR EACH ROW EXECUTE FUNCTION grok_transcript_turn_guard();

ALTER TABLE "GrokTranscriptTurn" ADD CONSTRAINT "GrokTranscriptTurn_speaker_check" CHECK ("speaker" IN ('caller', 'agent'));
ALTER TABLE "GrokTranscriptTurn" ADD CONSTRAINT "GrokTranscriptTurn_text_check" CHECK (char_length("text") BETWEEN 1 AND 4000);
