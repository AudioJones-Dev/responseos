-- ResponseOS v0.2 closeout step 2.3, PR 31B: call intelligence substrate.
--
-- Purely additive migration. Adds:
--   * Three new enum types.
--   * Three new tables: CallSegment, CallTranscript, QaLog.
--   * Indexes + unique constraints per the planning artifact §3.4–3.6.
--
-- No existing tables, columns, enums, or indexes are altered or dropped.
-- No foreign-key constraints are created (the schema continues the
-- Prisma logical-FK discipline established in 0001–0004).
--
-- Hard guardrail (per ADR-0019 step 2.3 authorization + planning Q7):
-- CallTranscript stores transcript content (inline_text and the
-- raw_ref / redacted_ref object-storage pointers), but the lib/data/*
-- accessor in this PR does NOT expose a privileged raw-transcript
-- read surface. That accessor lands after 31D ships
-- `audit_logs.category = "break_glass"`.
--
-- See:
--   - docs/product/RESPONSEOS_V0_2_REMAINING_MODELS_IMPLEMENTATION_PLAN.md §3.4–3.6
--   - docs/DECISIONS.md ADR-0019
--   - issue #27 (roadmap checkpoint)

-- CreateEnum
CREATE TYPE "CallSegmentSpeaker" AS ENUM ('caller', 'agent', 'system');

-- CreateEnum
CREATE TYPE "TranscriptRetentionLane" AS ENUM ('full', 'redacted_only', 'metadata_only');

-- CreateEnum
CREATE TYPE "QaReviewerType" AS ENUM ('human', 'system', 'automated_llm');

-- CreateTable
CREATE TABLE "CallSegment" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "call_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "speaker" "CallSegmentSpeaker" NOT NULL,
    "text" TEXT NOT NULL,
    "redacted_text" TEXT,
    "confidence" DOUBLE PRECISION,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallTranscript" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "call_id" TEXT NOT NULL,
    "raw_ref" TEXT,
    "redacted_ref" TEXT,
    "inline_text" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "retention_lane" "TranscriptRetentionLane" NOT NULL DEFAULT 'full',
    "expires_at" TIMESTAMP(3),
    "redacted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallTranscript_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QaLog" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "call_id" TEXT NOT NULL,
    "rubric_version" TEXT NOT NULL,
    "reviewer_type" "QaReviewerType" NOT NULL,
    "reviewer_user_id" TEXT,
    "score" INTEGER,
    "findings_json" JSONB NOT NULL,
    "notes" TEXT,
    "reviewed_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QaLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CallSegment_account_id_idx" ON "CallSegment"("account_id");

-- CreateIndex
CREATE INDEX "CallSegment_call_id_idx" ON "CallSegment"("call_id");

-- CreateIndex
CREATE INDEX "CallSegment_created_at_idx" ON "CallSegment"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "CallSegment_call_id_sequence_key" ON "CallSegment"("call_id", "sequence");

-- CreateIndex
CREATE INDEX "CallTranscript_account_id_idx" ON "CallTranscript"("account_id");

-- CreateIndex
CREATE INDEX "CallTranscript_expires_at_idx" ON "CallTranscript"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "CallTranscript_call_id_key" ON "CallTranscript"("call_id");

-- CreateIndex
CREATE INDEX "QaLog_account_id_idx" ON "QaLog"("account_id");

-- CreateIndex
CREATE INDEX "QaLog_call_id_idx" ON "QaLog"("call_id");

-- CreateIndex
CREATE INDEX "QaLog_reviewed_at_idx" ON "QaLog"("reviewed_at");
