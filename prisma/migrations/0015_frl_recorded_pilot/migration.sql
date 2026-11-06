-- CreateTable
CREATE TABLE "FrlPilotRun" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "call_id" TEXT NOT NULL,
    "window_id" TEXT NOT NULL,
    "config_digest" TEXT NOT NULL,
    "state_json" JSONB NOT NULL,
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "started_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FrlPilotRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FrlPilotCommand" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'pending',
    "intent_json" JSONB NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "dispatched_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "FrlPilotCommand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FrlPilotArtifact" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "window_id" TEXT NOT NULL,
    "recording_id" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3) NOT NULL,
    "transcript" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "purged_at" TIMESTAMP(3),

    CONSTRAINT "FrlPilotArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FrlPilotRun_account_id_window_id_idx" ON "FrlPilotRun"("account_id", "window_id");

-- CreateIndex
CREATE INDEX "FrlPilotRun_account_id_closed_idx" ON "FrlPilotRun"("account_id", "closed");

-- CreateIndex
CREATE UNIQUE INDEX "FrlPilotRun_account_id_call_id_key" ON "FrlPilotRun"("account_id", "call_id");

-- CreateIndex
CREATE INDEX "FrlPilotCommand_account_id_run_id_idx" ON "FrlPilotCommand"("account_id", "run_id");

-- CreateIndex
CREATE INDEX "FrlPilotCommand_account_id_state_idx" ON "FrlPilotCommand"("account_id", "state");

-- CreateIndex
CREATE INDEX "FrlPilotArtifact_account_id_expires_at_idx" ON "FrlPilotArtifact"("account_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "FrlPilotArtifact_account_id_recording_id_key" ON "FrlPilotArtifact"("account_id", "recording_id");

-- CreateIndex
CREATE UNIQUE INDEX "FrlPilotArtifact_account_id_run_id_window_id_key" ON "FrlPilotArtifact"("account_id", "run_id", "window_id");
