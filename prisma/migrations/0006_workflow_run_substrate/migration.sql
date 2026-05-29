-- ResponseOS v0.2 closeout step 2.3, PR 31C: workflow execution substrate.
--
-- Purely additive migration. Adds:
--   * One new enum type: WorkflowRunStatus.
--   * One new table: WorkflowRun.
--   * Indexes + unique constraint per the planning artifact §3.7.
--
-- No existing tables, columns, enums, or indexes are altered or dropped.
-- The existing `WorkflowProvider` enum (n8n / make / internal) is
-- reused for the `provider` column per planning Q12 — no new provider
-- enum was created. No foreign-key constraints are introduced.
--
-- Substrate only: this PR adds storage and tenant-scoped accessors for
-- workflow execution state. It does NOT add a runtime orchestrator, a
-- scheduler, a retry engine, an n8n callback handler, queue/worker
-- runtime, or any external webhook execution. Per ADR-0017, n8n stays
-- out of the realtime audio loop; the substrate ships now and the
-- async writer wires up in v0.3.
--
-- See:
--   - docs/product/RESPONSEOS_V0_2_REMAINING_MODELS_IMPLEMENTATION_PLAN.md §3.7
--   - docs/architecture/RESPONSEOS_EVENT_SCHEMA.md §6
--   - docs/DECISIONS.md ADR-0017
--   - issue #27 (roadmap checkpoint)

-- CreateEnum
CREATE TYPE "WorkflowRunStatus" AS ENUM ('started', 'completed', 'failed', 'cancelled', 'dead_letter');

-- CreateTable
CREATE TABLE "WorkflowRun" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "workflow_run_id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "provider" "WorkflowProvider" NOT NULL,
    "trigger_event_id" TEXT,
    "status" "WorkflowRunStatus" NOT NULL DEFAULT 'started',
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "error_message" TEXT,
    "payload_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowRun_workflow_run_id_key" ON "WorkflowRun"("workflow_run_id");

-- CreateIndex
CREATE INDEX "WorkflowRun_account_id_idx" ON "WorkflowRun"("account_id");

-- CreateIndex
CREATE INDEX "WorkflowRun_workflow_id_idx" ON "WorkflowRun"("workflow_id");

-- CreateIndex
CREATE INDEX "WorkflowRun_status_idx" ON "WorkflowRun"("status");

-- CreateIndex
CREATE INDEX "WorkflowRun_started_at_idx" ON "WorkflowRun"("started_at");
