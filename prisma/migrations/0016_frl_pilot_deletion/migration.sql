ALTER TYPE "CallStatus" ADD VALUE 'ringing';
CREATE TABLE "FrlPilotDeletion" (
  "id" TEXT NOT NULL,
  "account_id" TEXT NOT NULL,
  "run_id" TEXT NOT NULL,
  "recording_id" TEXT NOT NULL,
  "resource_id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "due_at" TIMESTAMP(3) NOT NULL,
  "next_attempt_at" TIMESTAMP(3) NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "verified_at" TIMESTAMP(3),
  "last_error" TEXT,
  CONSTRAINT "FrlPilotDeletion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FrlPilotDeletion_account_id_kind_resource_id_key" ON "FrlPilotDeletion"("account_id", "kind", "resource_id");
CREATE INDEX "FrlPilotDeletion_account_id_state_next_attempt_at_idx" ON "FrlPilotDeletion"("account_id", "state", "next_attempt_at");
