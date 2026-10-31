#!/bin/bash
set -euo pipefail
# Run only in the disposable network-none PostgreSQL container; no external URL input.
export PGHOST=/var/run/postgresql PGUSER=synthetic
unset PGSERVICE PGSERVICEFILE PGHOSTADDR PGPASSWORD
cd /review
test "$(psql -d postgres -Atc 'show server_version_num')" = 160015
mkdir -p /tmp/frl-evidence
psql_db() { psql -X -v ON_ERROR_STOP=1 -d "$1" "${@:2}"; }
apply() { psql_db "$1" -1 -f "/review/prisma/migrations/$2/migration.sql" >/dev/null || return $?; echo "applied $1 $2"; }
createdb synthetic_preservation
for dir in /review/prisma/migrations/000[1-8]*; do apply synthetic_preservation "$(basename "$dir")"; done
psql_db synthetic_preservation <<'SQL'
INSERT INTO "Account" (id,name,slug,industry,timezone,status,updated_at) VALUES
('synthetic-legacy','Legacy Example','legacy-example','synthetic','UTC','paused','2026-01-01'),
('synthetic-demo','Separate Synthetic Demo','separate-demo','synthetic','UTC','active','2026-01-01');
INSERT INTO "Contact" (id,account_id,first_name,phone,source,updated_at) VALUES
('synthetic-contact','synthetic-legacy','Example','+12025550110','manual','2026-01-01');
INSERT INTO "Call" (id,account_id,provider,provider_call_id,direction,status,from_number,to_number,started_at,transcript) VALUES
('synthetic-call','synthetic-legacy','manual','synthetic-event','inbound','completed','+12025550110','+12025550111','2026-01-01','Fictional preservation sentinel');
INSERT INTO "CallTranscript" (id,account_id,call_id,inline_text) VALUES
('synthetic-transcript','synthetic-legacy','synthetic-call','Fictional retained text');
INSERT INTO "WebhookEvent" (id,account_id,provider,provider_event_id,event_type,raw_body,signature_valid,dedupe_hash) VALUES
('synthetic-hook','synthetic-legacy','manual','synthetic-hook-event','synthetic','fictional payload',false,'synthetic-hash');
INSERT INTO "AuditLog" (id,account_id,actor_type,action,metadata_json) VALUES
('synthetic-audit','synthetic-legacy','system','synthetic.preserved','{"sentinel":true}');
SQL
# Freeze the exact pre-0009 projection for every existing public table.
psql_db synthetic_preservation -At <<'SQL' > /tmp/frl-evidence/fingerprint.sql
SELECT format('SELECT %L || '':'' || count(*) || '':'' || coalesce(md5(string_agg(row_to_json(x)::text, '''' ORDER BY row_to_json(x)::text)), ''empty'') FROM (SELECT %s FROM public.%I) x;',
 table_name, string_agg(format('%I',column_name),',' ORDER BY ordinal_position), table_name)
FROM information_schema.columns WHERE table_schema='public' GROUP BY table_name ORDER BY table_name;
SQL
psql_db synthetic_preservation -Atf /tmp/frl-evidence/fingerprint.sql > /tmp/frl-evidence/before.txt
pg_dump -Fc -d synthetic_preservation -f /tmp/frl-evidence/pre-0009.dump
for dir in /review/prisma/migrations/0009* /review/prisma/migrations/001[0-2]*; do apply synthetic_preservation "$(basename "$dir")"; done
psql_db synthetic_preservation <<'SQL'
INSERT INTO "ProspectBootstrap" (id,account_id,canonical_website,status,created_at,updated_at) VALUES
('synthetic-review','synthetic-demo','https://example.invalid','draft','2026-01-01','2026-01-01'),
('synthetic-active','synthetic-demo','https://example.invalid','active','2026-01-01','2026-01-01');
SQL
apply synthetic_preservation 0013_prospect_bootstrap_review_controls
psql_db synthetic_preservation <<'SQL'
DO $$ BEGIN
IF (SELECT review_expires_at FROM "ProspectBootstrap" WHERE id='synthetic-review') IS DISTINCT FROM timestamp '2026-01-08'
OR (SELECT review_expires_at FROM "ProspectBootstrap" WHERE id='synthetic-active') IS NOT NULL
THEN RAISE EXCEPTION '0013 backfill mismatch'; END IF;
END $$;
SQL
# Inject a fault after the final ALTER; the explicit migration transaction must undo it.
cat prisma/migrations/20261028_inactive_client_setup/migration.sql > /tmp/frl-evidence/fault.sql
echo 'SELECT 1/0;' >> /tmp/frl-evidence/fault.sql
if psql_db synthetic_preservation -1 -f /tmp/frl-evidence/fault.sql; then exit 1; fi
test "$(psql_db synthetic_preservation -Atc "SELECT count(*) FROM information_schema.columns WHERE table_name='Account' AND column_name='setup_draft_json'")" = 0
apply synthetic_preservation 20261028_inactive_client_setup
psql_db synthetic_preservation -Atf /tmp/frl-evidence/fingerprint.sql > /tmp/frl-evidence/after.txt
cmp /tmp/frl-evidence/before.txt /tmp/frl-evidence/after.txt
test "$(psql_db synthetic_preservation -Atc 'SELECT count(*) FROM "Account" WHERE setup_draft_json IS NOT NULL')" = 0
echo 'PASS: all pre-0009 table projections preserved; final field null; 0013 backfill; injected ALTER rollback'
for kind in call webhook; do
  db="synthetic_failure_$kind"
  createdb "$db"
  pg_restore --exit-on-error --single-transaction -d "$db" /tmp/frl-evidence/pre-0009.dump
  apply "$db" 0009_internal_demo_professional_receptionist
  apply "$db" 0010_v0_3_provider_enum_alignment
  if [ "$kind" = call ]; then
    psql_db "$db" -c "INSERT INTO \"Call\" SELECT (jsonb_populate_record(NULL::\"Call\",to_jsonb(c)||'{\"id\":\"synthetic-duplicate\"}')).* FROM \"Call\" c;"
  else
    psql_db "$db" -c "INSERT INTO \"WebhookEvent\" SELECT (jsonb_populate_record(NULL::\"WebhookEvent\",to_jsonb(w)||'{\"id\":\"synthetic-duplicate\",\"dedupe_hash\":\"other-hash\"}')).* FROM \"WebhookEvent\" w;"
  fi
  if apply "$db" 0011_gtm_demo_closure_foundation; then exit 1; fi
  test "$(psql_db "$db" -Atc "SELECT count(*) FROM pg_indexes WHERE indexname IN ('Call_account_id_provider_provider_call_id_key','WebhookEvent_provider_provider_event_id_key')")" = 0
  test "$(psql_db "$db" -Atc "SELECT count(*) FROM information_schema.columns WHERE table_name='Contact' AND column_name='email_verified'")" = 0
  echo "PASS: $kind collision stops 0011; no partial migration under explicit transaction; duplicate evidence retained"
done
createdb synthetic_restored_baseline
pg_restore --exit-on-error --single-transaction -d synthetic_restored_baseline /tmp/frl-evidence/pre-0009.dump
psql_db synthetic_restored_baseline -Atf /tmp/frl-evidence/fingerprint.sql > /tmp/frl-evidence/restored.txt
cmp /tmp/frl-evidence/before.txt /tmp/frl-evidence/restored.txt
pg_dump -Fc -d synthetic_preservation -f /tmp/frl-evidence/post-setup.dump
createdb synthetic_restored_post
pg_restore --exit-on-error --single-transaction -d synthetic_restored_post /tmp/frl-evidence/post-setup.dump
psql_db synthetic_restored_post -Atf /tmp/frl-evidence/fingerprint.sql > /tmp/frl-evidence/restored-post.txt
cmp /tmp/frl-evidence/before.txt /tmp/frl-evidence/restored-post.txt
psql_db synthetic_preservation -At <<'SQL' > /tmp/frl-evidence/full-fingerprint.sql
SELECT format('SELECT %L || '':'' || count(*) || '':'' || coalesce(md5(string_agg(row_to_json(x)::text, '''' ORDER BY row_to_json(x)::text)), ''empty'') FROM (SELECT %s FROM public.%I) x;',
 table_name, string_agg(format('%I',column_name),',' ORDER BY ordinal_position), table_name)
FROM information_schema.columns WHERE table_schema='public' GROUP BY table_name ORDER BY table_name;
SQL
psql_db synthetic_preservation -Atf /tmp/frl-evidence/full-fingerprint.sql > /tmp/frl-evidence/full-before.txt
psql_db synthetic_restored_post -Atf /tmp/frl-evidence/full-fingerprint.sql > /tmp/frl-evidence/full-restored.txt
cmp /tmp/frl-evidence/full-before.txt /tmp/frl-evidence/full-restored.txt
echo 'PASS: synthetic baseline and post-migration dumps restored to fresh databases; no production restore rehearsal'
sha256sum prisma/migrations/*/migration.sql /tmp/frl-evidence/*.dump
