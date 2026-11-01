#!/bin/bash
set -uo pipefail
export CHECKPOINT_DISABLE=1 PRISMA_HIDE_UPDATE_MESSAGE=1
mkdir -p /out && cd /work && tar -xf /in/source.tar
echo "source_sha=$(cat /in/SOURCE_SHA)" | tee /out/control-summary.txt
npx prisma migrate diff --from-url "$DATABASE_URL" --to-url "postgresql://responseos:responseos@127.0.0.1:5432/responseos_restore" --exit-code > /out/restore-schema-diff.log 2>&1; echo "restore-schema-diff exit=$?" | tee -a /out/control-summary.txt
# Negative control: new tests, original 6a355c6 setup service and contracts.
cp /in/original/service.ts lib/clientSetup/service.ts; cp /in/original/contracts.ts lib/clientSetup/contracts.ts
echo "control service sha256=$(sha256sum lib/clientSetup/service.ts | cut -c1-64) contracts sha256=$(sha256sum lib/clientSetup/contracts.ts | cut -c1-64)" | tee -a /out/control-summary.txt
npx vitest run --config vitest.integration.config.ts tests/integration/client-setup.integration.test.ts > /out/negative-control.log 2>&1; echo "negative-control exit=$?" | tee -a /out/control-summary.txt
