CREATE TYPE "CallControlState" AS ENUM ('CALL_RECEIVED', 'DISCLOSURE_PLAYING', 'AWAITING_DTMF', 'CONSENT_PENDING_OPERATOR', 'START_PENDING', 'AI_ACTIVE', 'REFUSED', 'AMBIGUOUS', 'STOP_PENDING', 'STOPPED', 'TRANSFER_PENDING', 'TRANSFERRED', 'SAFE_FALLBACK', 'FINALIZING', 'EVIDENCE_FROZEN');
CREATE TYPE "CallDtmfDecision" AS ENUM ('affirmative', 'refused', 'ambiguous');
CREATE TYPE "TelnyxCallCommandType" AS ENUM ('answer', 'disclosure', 'consent_gather', 'refusal_ack', 'ambiguous_end', 'ai_assistant_start', 'ai_assistant_stop', 'transfer', 'hangup');
CREATE TYPE "TelnyxCallCommandStatus" AS ENUM ('intent_recorded', 'succeeded', 'failed', 'uncertain');
CREATE TYPE "PostCallAnalysisCompleteness" AS ENUM ('complete', 'partial', 'unavailable');

ALTER TABLE "CallCaptureSession"
  ADD COLUMN "control_state" "CallControlState" NOT NULL DEFAULT 'CALL_RECEIVED',
  ADD COLUMN "generation" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "call_session_id" TEXT,
  ADD COLUMN "call_leg_id" TEXT,
  ADD COLUMN "conversation_id" TEXT,
  ADD COLUMN "dtmf_decision" "CallDtmfDecision",
  ADD COLUMN "dtmf_event_id" TEXT,
  ADD COLUMN "disclosure_completed_at" TIMESTAMP(3),
  ADD COLUMN "content_admission_closed_at" TIMESTAMP(3),
  ADD COLUMN "capture_started_at" TIMESTAMP(3),
  ADD COLUMN "capture_ended_at" TIMESTAMP(3);

CREATE TABLE "TelnyxCallCommand" (
  "id" TEXT NOT NULL,
  "account_id" TEXT NOT NULL,
  "capture_session_id" TEXT NOT NULL,
  "assignment_id" TEXT NOT NULL,
  "command_type" "TelnyxCallCommandType" NOT NULL,
  "generation" INTEGER NOT NULL,
  "command_id" TEXT NOT NULL,
  "provider_resource" TEXT NOT NULL,
  "request_json" JSONB NOT NULL,
  "status" "TelnyxCallCommandStatus" NOT NULL DEFAULT 'intent_recorded',
  "intended_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "provider_responded_at" TIMESTAMP(3),
  "provider_response_status" INTEGER,
  "provider_date_at" TIMESTAMP(3),
  "conversation_id" TEXT,
  "error_code" TEXT,
  "reconciliation_state" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TelnyxCallCommand_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TelnyxCallCommand_command_id_key" ON "TelnyxCallCommand"("command_id");
CREATE UNIQUE INDEX "TelnyxCallCommand_capture_type_generation_key" ON "TelnyxCallCommand"("capture_session_id", "command_type", "generation");
CREATE INDEX "TelnyxCallCommand_account_id_capture_session_id_idx" ON "TelnyxCallCommand"("account_id", "capture_session_id");
CREATE INDEX "TelnyxCallCommand_status_intended_at_idx" ON "TelnyxCallCommand"("status", "intended_at");

CREATE TABLE "CallTranscriptRevision" (
  "id" TEXT NOT NULL,
  "account_id" TEXT NOT NULL,
  "call_id" TEXT NOT NULL,
  "capture_session_id" TEXT NOT NULL,
  "assignment_id" TEXT NOT NULL,
  "snapshot_id" TEXT NOT NULL,
  "conversation_id" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "source_hash" TEXT NOT NULL,
  "inline_text" TEXT NOT NULL,
  "source_event_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "capture_started_at" TIMESTAMP(3) NOT NULL,
  "capture_ended_at" TIMESTAMP(3),
  "frozen_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CallTranscriptRevision_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CallTranscriptRevision_account_call_revision_key" ON "CallTranscriptRevision"("account_id", "call_id", "revision");
CREATE UNIQUE INDEX "CallTranscriptRevision_capture_hash_key" ON "CallTranscriptRevision"("capture_session_id", "source_hash");
CREATE INDEX "CallTranscriptRevision_account_id_call_id_idx" ON "CallTranscriptRevision"("account_id", "call_id");

CREATE TABLE "CallPostCallAnalysis" (
  "id" TEXT NOT NULL,
  "account_id" TEXT NOT NULL,
  "call_id" TEXT NOT NULL,
  "transcript_revision_id" TEXT NOT NULL,
  "transcript_hash" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "prompt_version" TEXT NOT NULL,
  "schema_version" TEXT NOT NULL,
  "result_json" JSONB NOT NULL,
  "completeness" "PostCallAnalysisCompleteness" NOT NULL,
  "uncertainty_json" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CallPostCallAnalysis_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CallPostCallAnalysis_transcript_revision_id_key" ON "CallPostCallAnalysis"("transcript_revision_id");
CREATE INDEX "CallPostCallAnalysis_account_id_call_id_idx" ON "CallPostCallAnalysis"("account_id", "call_id");
