\set ON_ERROR_STOP on
-- Review template only. Supply every parameter from the separately approved manifest.
-- Keep ROLLBACK: changing it to COMMIT requires a separately reviewed execution artifact.
-- READ COMMITTED is deliberate: every statement after the locks takes a fresh snapshot,
-- so the checks see every row committed before the locks were granted. Under SERIALIZABLE
-- the snapshot would be fixed by the first query, before the lock waits.
BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SELECT pg_advisory_xact_lock(190028, 1);
-- Also exclude writers that do not participate in the advisory-lock convention.
LOCK TABLE "Account", "TelephonyNumber", "TelephonyNumberAssignment" IN SHARE ROW EXCLUSIVE MODE;
-- Schema uses logical foreign keys. Lock every account_id table before any check runs.
DO $locks$
DECLARE t record;
BEGIN
  FOR t IN SELECT DISTINCT c.table_name FROM information_schema.columns c
    JOIN information_schema.tables tb ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name AND tb.table_type = 'BASE TABLE'
    WHERE c.table_schema = 'public' AND c.column_name = 'account_id' ORDER BY c.table_name
  LOOP
    EXECUTE format('LOCK TABLE public.%I IN SHARE ROW EXCLUSIVE MODE', t.table_name);
  END LOOP;
END $locks$;
CREATE TEMP TABLE release_input ON COMMIT DROP AS SELECT
  :'account_id'::text AS id, :'business_name'::text AS name, :'slug'::text AS slug,
  :'industry'::text AS industry, :'timezone'::text AS timezone,
  :'founder_name'::text AS founder, :'contact_number'::text AS phone,
  :'operator_id'::text AS operator_id, :'expected_account_json'::jsonb AS expected,
  :'expected_phone_references'::int AS expected_phone_references,
  :'separate_demo_id'::text AS separate_demo_id;
DO $review$
DECLARE
  i record; existing jsonb; draft jsonb; t record; referenced boolean; actor "UserRole";
  digits text; forms text[]; phone_references int;
BEGIN
  SELECT * INTO STRICT i FROM release_input;
  -- Mirrors CreateSetupSchema: trimmed, non-empty, at most 120 characters.
  IF i.id = '' OR i.separate_demo_id = '' OR i.id = i.separate_demo_id
     OR i.name IS DISTINCT FROM btrim(i.name) OR i.name = '' OR length(i.name) > 120
     OR i.slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' OR length(i.slug) > 120
     OR i.industry IS DISTINCT FROM btrim(i.industry) OR i.industry = '' OR length(i.industry) > 120
     OR i.founder IS DISTINCT FROM btrim(i.founder) OR i.founder = '' OR length(i.founder) > 120
     OR i.phone !~ '^\+[1-9][0-9]{7,14}$'
     OR NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = i.timezone)
     OR i.expected_phone_references < 0
  THEN RAISE EXCEPTION 'Owner decisions or identity invalid'; END IF;
  SELECT role INTO actor FROM "User" WHERE id = i.operator_id AND role IN ('aj_admin','operator');
  IF actor IS NULL THEN RAISE EXCEPTION 'Existing operator identity required'; END IF;
  SELECT to_jsonb(a) INTO existing FROM "Account" a WHERE id = i.id FOR UPDATE;
  IF coalesce(existing, 'null'::jsonb) IS DISTINCT FROM i.expected THEN
    RAISE EXCEPTION 'Identity changed since reviewed snapshot';
  END IF;
  IF existing IS NOT NULL AND (
    existing->>'name' IS DISTINCT FROM i.name OR existing->>'slug' IS DISTINCT FROM i.slug
    OR existing->>'industry' IS DISTINCT FROM i.industry OR existing->>'timezone' IS DISTINCT FROM i.timezone
    OR existing->>'status' IS DISTINCT FROM 'paused' OR existing->>'account_type' IS DISTINCT FROM 'customer'
    OR existing->>'primary_phone' IS NOT NULL OR existing->>'clerk_org_id' IS NOT NULL
    OR existing->>'setup_draft_json' IS NOT NULL
  ) THEN RAISE EXCEPTION 'Candidate ID is not an empty compatible inactive customer'; END IF;
  -- Same rule as phoneDigitForms() in lib/clientSetup/contracts.ts: digits only, and a
  -- NANP number also matches its ten-digit national form.
  digits := regexp_replace(i.phone, '[^0-9]', '', 'g');
  forms := CASE WHEN length(digits) = 11 AND left(digits, 1) = '1' THEN ARRAY[digits, substr(digits, 2)] ELSE ARRAY[digits] END;
  IF EXISTS (
    SELECT 1 FROM "Account" a WHERE a.id <> i.id AND (
      a.slug = i.slug
      OR regexp_replace(replace(lower(normalize(a.name, NFKC)), '&', 'and'), '[^[:alnum:]]', '', 'g')
       = regexp_replace(replace(lower(normalize(i.name, NFKC)), '&', 'and'), '[^[:alnum:]]', '', 'g')
      OR regexp_replace(coalesce(a.primary_phone, ''), '[^0-9]', '', 'g') = ANY(forms)
      OR regexp_replace(coalesce(a.setup_draft_json->>'contactNumber', ''), '[^0-9]', '', 'g') = ANY(forms)
    )
  ) OR EXISTS (SELECT 1 FROM "TelephonyNumber" WHERE regexp_replace(e164, '[^0-9]', '', 'g') = ANY(forms))
  THEN RAISE EXCEPTION 'Identity or number collision requires reconciliation'; END IF;
  -- History references are not ownership, but each must have been reviewed. The operator
  -- supplies the exact count from a separately authorized readback; any drift aborts.
  SELECT
    (SELECT count(*) FROM "User" WHERE regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') = ANY(forms))
    + (SELECT count(*) FROM "Contact" WHERE regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') = ANY(forms))
    + (SELECT count(*) FROM "Call" WHERE regexp_replace(from_number, '[^0-9]', '', 'g') = ANY(forms) OR regexp_replace(to_number, '[^0-9]', '', 'g') = ANY(forms))
    + (SELECT count(*) FROM "Conversation" WHERE regexp_replace(business_number, '[^0-9]', '', 'g') = ANY(forms) OR regexp_replace(peer_number, '[^0-9]', '', 'g') = ANY(forms))
    + (SELECT count(*) FROM "SmsMessage" WHERE regexp_replace(from_number, '[^0-9]', '', 'g') = ANY(forms) OR regexp_replace(to_number, '[^0-9]', '', 'g') = ANY(forms))
  INTO phone_references;
  IF phone_references <> i.expected_phone_references THEN
    RAISE EXCEPTION 'Number history references (%) differ from the reviewed count (%)', phone_references, i.expected_phone_references;
  END IF;
  FOR t IN SELECT DISTINCT c.table_name FROM information_schema.columns c
    JOIN information_schema.tables tb ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name AND tb.table_type = 'BASE TABLE'
    WHERE c.table_schema = 'public' AND c.column_name = 'account_id' ORDER BY c.table_name
  LOOP
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE account_id = $1)', t.table_name)
      INTO referenced USING i.id;
    IF referenced THEN RAISE EXCEPTION 'Candidate has dependent evidence in %; preserve and reconcile', t.table_name; END IF;
  END LOOP;
  draft := jsonb_build_object(
    'schemaVersion','inactive-client-setup.v1','revision',1,'status','draft',
    'founderName',i.founder,'contactNumber',i.phone,'facts','[]'::jsonb,
    'disclosure',jsonb_build_object('text','','purpose','','consentFlow','','refusalFlow',''),
    'ownershipVerification','pending','routingVerification','pending','provisioned',false,
    'capabilities',jsonb_build_object('recording',false,'transcription',false,'aiAnswering',false,
      'forwarding',false,'outboundCalls',false,'automatedFollowUp',false,'memoryIngestion',false),
    'receptionistPublication','not_published','consentApproval','pending');
  IF existing IS NULL THEN
    INSERT INTO "Account" (id,name,slug,industry,timezone,status,account_type,setup_draft_json,updated_at)
      VALUES (i.id,i.name,i.slug,i.industry,i.timezone,'paused','customer',draft,CURRENT_TIMESTAMP);
  ELSE
    UPDATE "Account" SET setup_draft_json = draft, updated_at = CURRENT_TIMESTAMP WHERE id = i.id;
  END IF;
  INSERT INTO "AuditLog" (id,account_id,actor_type,actor_user_id,actor_role,action,category,target_type,target_id,reason,metadata_json)
    VALUES ('inactive-setup-' || i.id,i.id,'user',i.operator_id,actor,'client_setup.created','workflow','Account',i.id,
      'Reviewed inactive setup; no access, provider activation or history import.', '{"revision":1}'::jsonb);
END $review$;
SELECT id,status,account_type,primary_phone,clerk_org_id,setup_draft_json FROM "Account" WHERE id = :'account_id';
ROLLBACK;
