ALTER TABLE "ProspectBootstrap"
ADD COLUMN "converted_at" TIMESTAMP(3),
ADD COLUMN "review_expires_at" TIMESTAMP(3);

CREATE INDEX "ProspectBootstrap_review_expires_at_idx"
ON "ProspectBootstrap"("review_expires_at");

UPDATE "ProspectBootstrap"
SET "review_expires_at" = "created_at" + INTERVAL '7 days'
WHERE "status" IN ('draft', 'ingesting', 'review_required', 'approved', 'provisioning', 'failed')
  AND "review_expires_at" IS NULL;

ALTER TABLE "KnowledgeFact"
ADD COLUMN "source_evidence_json" JSONB;
