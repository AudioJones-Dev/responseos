-- Empty-install rollback only. Populated installations retain schema and roll back code.
-- Run with psql -v ON_ERROR_STOP=1 against an explicitly verified target.
BEGIN;
LOCK TABLE "FrlOutboxOperation", "FrlInquiryEvent", "FrlInquiry" IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "FrlInquiry") OR EXISTS (SELECT 1 FROM "FrlInquiryEvent")
     OR EXISTS (SELECT 1 FROM "FrlOutboxOperation") THEN
    RAISE EXCEPTION 'frl_rollback_requires_empty_tables';
  END IF;
END;
$$;
DROP TABLE "FrlOutboxOperation";
DROP TABLE "FrlInquiryEvent";
DROP TABLE "FrlInquiry";
DROP FUNCTION frl_reject_event_mutation();
COMMIT;
