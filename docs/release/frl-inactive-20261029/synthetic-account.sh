#!/bin/bash
set -euo pipefail
export PGHOST=/var/run/postgresql PGUSER=synthetic
unset PGSERVICE PGSERVICEFILE PGHOSTADDR PGPASSWORD
cd /review
db=synthetic_account_transaction
createdb "$db"
pg_restore --exit-on-error --single-transaction -d "$db" /tmp/frl-evidence/post-setup.dump
sql() { psql -X -v ON_ERROR_STOP=1 -d "$db" "$@"; }
sql -c "INSERT INTO \"User\" (id,role,name,email,updated_at) VALUES ('synthetic-operator','operator','Synthetic Operator','operator@example.invalid',now());"
args=(-v account_id=synthetic-candidate -v business_name='Synthetic Access Company' -v slug=synthetic-access
  -v industry=synthetic -v timezone=UTC -v founder_name='Synthetic Founder' -v contact_number=+12025550199
  -v operator_id=synthetic-operator -v expected_account_json=null -v expected_phone_references=0 -v separate_demo_id=synthetic-demo)
template=/review/account-transaction.sql
refuse() { if sql "${args[@]}" "$@" -f "$template" >/tmp/frl-evidence/transaction-last.log 2>&1; then echo 'Unexpected transaction success'; exit 1; fi; cat /tmp/frl-evidence/transaction-last.log; }
sql "${args[@]}" -f "$template"
test "$(sql -Atc "SELECT count(*) FROM \"Account\" WHERE id='synthetic-candidate'")" = 0
echo 'PASS: review transaction ends in rollback'
refuse -v industry=
refuse -v timezone=Invalid/Zone
refuse -v operator_id=nonexistent
refuse -v account_id=synthetic-legacy
refuse -v account_id=synthetic-demo
refuse -v separate_demo_id=
refuse -v business_name=' Synthetic Access Company'
refuse -v founder_name='   '
refuse -v expected_phone_references=-1
sql -c "INSERT INTO \"Account\" (id,name,slug,industry,timezone,status,updated_at,setup_draft_json) VALUES ('synthetic-collision','Other Example','other-example','synthetic','UTC','paused',now(),'{\"contactNumber\":\"+1 (202) 555-0199\"}');"
refuse
sql -c "DELETE FROM \"Account\" WHERE id='synthetic-collision'; INSERT INTO \"TelephonyNumber\" (id,provider,provider_number_id,e164,status,updated_at) VALUES ('synthetic-number','synthetic','synthetic-number','+12025550199','released',now());"
refuse
sql -c "UPDATE \"TelephonyNumber\" SET e164='(202) 555-0199' WHERE id='synthetic-number';"
refuse
sql -c "DELETE FROM \"TelephonyNumber\" WHERE id='synthetic-number'; INSERT INTO \"Account\" (id,name,slug,industry,timezone,status,updated_at,primary_phone) VALUES ('synthetic-collision','Other Example','other-example','synthetic','UTC','paused',now(),'202-555-0199');"
refuse
# History references must match the operator-reviewed count exactly.
sql -c "DELETE FROM \"Account\" WHERE id='synthetic-collision'; INSERT INTO \"Contact\" (id,account_id,phone,source,updated_at) VALUES ('synthetic-history','synthetic-legacy','202 555 0199','call',now());"
refuse
grep -q 'Number history references (1) differ from the reviewed count (0)' /tmp/frl-evidence/transaction-last.log
sql "${args[@]}" -v expected_phone_references=1 -f "$template"
refuse -v expected_phone_references=2
sql -c "DELETE FROM \"Contact\" WHERE id='synthetic-history';"
echo 'PASS: national-format inventory/primary phone refuse; history references require the exact reviewed count'
sql -c "INSERT INTO \"Account\" (id,name,slug,industry,timezone,status,updated_at) VALUES ('synthetic-collision','SYNTHETIC ACCESS COMPANY!','other-example','synthetic','UTC','paused',now());"
refuse
sql -c "UPDATE \"Account\" SET name='Different',slug='synthetic-access' WHERE id='synthetic-collision';"
refuse
sql -c "DELETE FROM \"Account\" WHERE id='synthetic-collision'; INSERT INTO \"AuditLog\" (id,account_id,actor_type,action) VALUES ('synthetic-orphan','synthetic-candidate','system','synthetic.history');"
refuse
sql -c "DELETE FROM \"AuditLog\" WHERE id='synthetic-orphan';"
sql <<'SQL'
CREATE FUNCTION synthetic_reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic audit failure'; END $$;
CREATE TRIGGER synthetic_reject_audit BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION synthetic_reject_audit();
SQL
refuse
test "$(sql -Atc "SELECT count(*) FROM \"Account\" WHERE id='synthetic-candidate'")" = 0
sql -c 'DROP TRIGGER synthetic_reject_audit ON "AuditLog"; DROP FUNCTION synthetic_reject_audit();'
echo 'PASS: missing decisions, role, stale/occupied ID, malformed contact, inventory, name, slug, orphan history and audit failure refuse atomically'
# Exercise the proposed SQL with a synthetic-only commit copy. The review file stays ROLLBACK.
sed 's/^ROLLBACK;$/COMMIT;/' "$template" > /tmp/frl-evidence/synthetic-commit.sql
sql "${args[@]}" -f /tmp/frl-evidence/synthetic-commit.sql
sql <<'SQL'
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM "Account" WHERE id='synthetic-candidate' AND status='paused' AND account_type='customer'
 AND primary_phone IS NULL AND clerk_org_id IS NULL
 AND setup_draft_json->>'receptionistPublication'='not_published'
 AND setup_draft_json->>'consentApproval'='pending'
 AND setup_draft_json->'capabilities'='{"recording":false,"transcription":false,"aiAnswering":false,"forwarding":false,"outboundCalls":false,"automatedFollowUp":false,"memoryIngestion":false}'::jsonb)
THEN RAISE EXCEPTION 'Inactive contract mismatch'; END IF;
IF (SELECT count(*) FROM "AuditLog" WHERE account_id='synthetic-candidate') <> 1 THEN RAISE EXCEPTION 'Audit mismatch'; END IF;
END $$;
SQL
refuse
sql -c "INSERT INTO \"Account\" (id,name,slug,industry,timezone,status,account_type,updated_at) VALUES ('synthetic-compatible','Compatible Example','compatible-example','synthetic','UTC','paused','customer',now());"
expected=$(sql -Atc "SELECT to_jsonb(a) FROM \"Account\" a WHERE id='synthetic-compatible'")
sql "${args[@]}" -v account_id=synthetic-compatible -v business_name='Compatible Example' -v slug=compatible-example -v contact_number=+12025550198 -v expected_account_json="$expected" -f /tmp/frl-evidence/synthetic-commit.sql
echo 'PASS: new and compatible-ID synthetic commits; replay refuses; all seven off; no access/routing bindings'
pg_dump -Fc -d "$db" -f /tmp/frl-evidence/account-committed.dump
createdb synthetic_account_restored
pg_restore --exit-on-error --single-transaction -d synthetic_account_restored /tmp/frl-evidence/account-committed.dump
query='SELECT id,setup_draft_json FROM "Account" ORDER BY id; SELECT id,account_id,action,metadata_json FROM "AuditLog" ORDER BY id;'
sql -Atc "$query" > /tmp/frl-evidence/account-before.txt
psql -X -v ON_ERROR_STOP=1 -d synthetic_account_restored -Atc "$query" > /tmp/frl-evidence/account-restored.txt
cmp /tmp/frl-evidence/account-before.txt /tmp/frl-evidence/account-restored.txt
echo 'PASS: synthetic draft and audit restore exact'
