-- Review only: no hosted execution authorized. Additive; no account backfill.
ALTER TABLE "Account" ADD COLUMN "setup_draft_json" JSONB;
