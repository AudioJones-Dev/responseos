#!/bin/bash
set -euo pipefail
# Run only in the disposable network-none PostgreSQL container after synthetic-migrations.sh.
# Each case holds a competing writer's transaction open, proves the template is waiting on a
# relation lock, then commits the writer. The template must then see the committed row.
export PGHOST=/var/run/postgresql PGUSER=synthetic
unset PGSERVICE PGSERVICEFILE PGHOSTADDR PGPASSWORD
cd /review
db=synthetic_account_concurrency
createdb "$db"
pg_restore --exit-on-error --single-transaction -d "$db" /tmp/frl-evidence/post-setup.dump
sql() { psql -X -v ON_ERROR_STOP=1 -d "$db" "$@"; }
sql -c "INSERT INTO \"User\" (id,role,name,email,updated_at) VALUES ('synthetic-operator','operator','Synthetic Operator','operator@example.invalid',now());"
args=(-v account_id=synthetic-candidate -v business_name='Synthetic Access Company' -v slug=synthetic-access
  -v industry=synthetic -v timezone=UTC -v founder_name='Synthetic Founder' -v contact_number=+12025550199
  -v operator_id=synthetic-operator -v expected_account_json=null -v expected_phone_references=0 -v separate_demo_id=synthetic-demo)
out=/tmp/frl-evidence/concurrency
mkdir -p "$out"

wait_for() {
  for _ in $(seq 400); do
    [ "$(sql -Atc "$1")" = "$2" ] && return 0
    sleep 0.025
  done
  echo "Timed out waiting for: $1"; exit 1
}

# $1 case name, $2 template, $3 competing writer SQL, $4 expected template outcome (refuse|success), $5 expected message
run_case() {
  local name=$1 template=$2 writer=$3 expect=$4 message=$5 rc
  rm -f "$out/$name.fifo"; mkfifo "$out/$name.fifo"
  psql -X -v ON_ERROR_STOP=1 -d "$db" < "$out/$name.fifo" > "$out/$name.writer.log" 2>&1 &
  local writer_pid=$!
  exec 3>"$out/$name.fifo"
  printf 'BEGIN;\n%s\n' "$writer" >&3
  wait_for "SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND state = 'idle in transaction' AND pid <> pg_backend_pid()" 1
  sql "${args[@]}" -f "$template" > "$out/$name.template.log" 2>&1 &
  local template_pid=$!
  wait_for "SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND wait_event = 'relation'" 1
  printf 'COMMIT;\n' >&3
  exec 3>&-
  wait "$writer_pid"
  if wait "$template_pid"; then rc=0; else rc=$?; fi
  if [ "$expect" = refuse ]; then
    [ "$rc" -ne 0 ] || { echo "FAIL: $name template succeeded"; cat "$out/$name.template.log"; exit 1; }
    grep -q "$message" "$out/$name.template.log" || { echo "FAIL: $name wrong refusal"; cat "$out/$name.template.log"; exit 1; }
  else
    [ "$rc" -eq 0 ] || { echo "FAIL: $name expected the original template to succeed"; cat "$out/$name.template.log"; exit 1; }
  fi
  test "$(sql -Atc "SELECT count(*) FROM \"Account\" WHERE id='synthetic-candidate'")" = 0
  echo "PASS: $name"
}

account_writer="INSERT INTO \"Account\" (id,name,slug,industry,timezone,status,updated_at) VALUES ('synthetic-racer','SYNTHETIC access company','synthetic-racer','synthetic','UTC','lead',now());"
cleanup_account="DELETE FROM \"Account\" WHERE id='synthetic-racer';"

git_template=/review/account-transaction.sql
original_template=/review/original-account-transaction.sql

run_case account-collision "$git_template" "$account_writer" refuse 'Identity or number collision requires reconciliation'
sql -c "$cleanup_account"
run_case national-inventory "$git_template" "INSERT INTO \"TelephonyNumber\" (id,provider,provider_number_id,e164,status,updated_at) VALUES ('synthetic-racer-number','synthetic','synthetic-racer-number','(202) 555-0199','available',now());" refuse 'Identity or number collision requires reconciliation'
sql -c "DELETE FROM \"TelephonyNumber\" WHERE id='synthetic-racer-number';"
run_case orphan-evidence "$git_template" "INSERT INTO \"AuditLog\" (id,account_id,actor_type,action) VALUES ('synthetic-racer-audit','synthetic-candidate','system','synthetic.history');" refuse 'Candidate has dependent evidence in AuditLog'
sql -c "DELETE FROM \"AuditLog\" WHERE id='synthetic-racer-audit';"
run_case history-reference "$git_template" "INSERT INTO \"Contact\" (id,account_id,phone,source,updated_at) VALUES ('synthetic-racer-contact','synthetic-legacy','202-555-0199','call',now());" refuse 'Number history references (1) differ from the reviewed count (0)'
sql -c "DELETE FROM \"Contact\" WHERE id='synthetic-racer-contact';"

# Defect reproduction: the 6a355c6 template fixed its SERIALIZABLE snapshot before waiting
# for the table lock, so it does not see the committed colliding account and succeeds.
run_case original-template-misses-collision "$original_template" "$account_writer" success ''
sql -c "$cleanup_account"
echo 'PASS: rows committed during lock waits are seen; the original template reproduces the missed collision'
