-- ADR-0086: human follow-up for finalized non-qualified calls. Additive; no backfill.
-- CreateEnum
CREATE TYPE "CallFollowUpReason" AS ENUM ('unqualified', 'maybe', 'not_scored');

-- CreateEnum
CREATE TYPE "CallFollowUpStatus" AS ENUM ('open', 'resolved');

-- CreateTable
CREATE TABLE "FollowUpRouting" (
    "account_id" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "backup_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FollowUpRouting_pkey" PRIMARY KEY ("account_id")
);

-- CreateTable
CREATE TABLE "CallFollowUp" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "call_id" TEXT NOT NULL,
    "reason" "CallFollowUpReason" NOT NULL,
    "status" "CallFollowUpStatus" NOT NULL DEFAULT 'open',
    "owner_user_id" TEXT NOT NULL,
    "backup_user_id" TEXT NOT NULL,
    "due_at" TIMESTAMP(3) NOT NULL,
    "resolved_at" TIMESTAMP(3),
    "resolved_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallFollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CallFollowUp_account_id_status_due_at_idx" ON "CallFollowUp"("account_id", "status", "due_at");

-- CreateIndex
CREATE UNIQUE INDEX "CallFollowUp_account_id_call_id_key" ON "CallFollowUp"("account_id", "call_id");

