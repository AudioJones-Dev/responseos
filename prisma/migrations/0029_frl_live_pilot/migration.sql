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
ALTER TABLE "CallCaptureSession" ADD CONSTRAINT "CallCaptureSession_admission_mode_check" CHECK ("admission_mode" IN ('qualification', 'pilot'));

ALTER TABLE "GrokTranscriptTurn" ADD CONSTRAINT "GrokTranscriptTurn_speaker_check" CHECK ("speaker" IN ('caller', 'agent'));
ALTER TABLE "GrokTranscriptTurn" ADD CONSTRAINT "GrokTranscriptTurn_text_check" CHECK (char_length("text") BETWEEN 1 AND 4000);
