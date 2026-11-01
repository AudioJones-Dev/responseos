#!/bin/bash
set -uo pipefail
export CHECKPOINT_DISABLE=1 PRISMA_HIDE_UPDATE_MESSAGE=1
mkdir -p /out && cd /work && tar -xf /in/source.tar
echo "source_sha=$(cat /in/SOURCE_SHA) node=$(node -v)"
node docs/release/frl-inactive-20261029/prisma-failure.mjs; echo "prisma-failure exit=$?"
