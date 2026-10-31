#!/bin/bash
set -uo pipefail
export CHECKPOINT_DISABLE=1 PRISMA_HIDE_UPDATE_MESSAGE=1 NEXT_TELEMETRY_DISABLED=1
OUT=/out; mkdir -p "$OUT"
step() { local name=$1; shift; echo "== $name"; "$@" > "$OUT/$name.log" 2>&1; local rc=$?; echo "$name exit=$rc" | tee -a "$OUT/summary.txt"; return 0; }
cd /work && tar -xf /in/source.tar
echo "source_sha=$(cat /in/SOURCE_SHA) tree=$(cat /in/SOURCE_TREE) tar_sha256=$(sha256sum /in/source.tar | cut -c1-64) node=$(node -v) npm=$(npm -v) postgres_target=${PG_LABEL:-unset}" | tee "$OUT/summary.txt"
DBURL=$DATABASE_URL
if [ "${MODE:-full}" = full ]; then
  ( unset DATABASE_URL DIRECT_URL; step lint npm run lint; step typecheck npm run typecheck; step unit npm test; step build-no-database npm run build )
fi
export DATABASE_URL=$DBURL DIRECT_URL=$DBURL
step migrate-diff npx prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-migrations prisma/migrations --shadow-database-url "postgresql://responseos:responseos@127.0.0.1:5432/responseos_shadow" --exit-code
step migrate-deploy npx prisma migrate deploy
step seed npx prisma db seed
step integration npm run test:integration
[ "${MODE:-full}" = full ] && step build-database npm run build
echo VALIDATE_DONE
