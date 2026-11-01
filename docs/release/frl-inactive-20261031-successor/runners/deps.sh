#!/bin/bash
set -euo pipefail
export CHECKPOINT_DISABLE=1 PRISMA_HIDE_UPDATE_MESSAGE=1 NEXT_TELEMETRY_DISABLED=1 npm_config_fund=false npm_config_update_notifier=false
node --version; npm --version
mkdir -p /work && cd /work
tar -xf /in/source.tar
npm ci
npx prisma generate
ls node_modules/@prisma/engines | head
echo DEPS_OK
