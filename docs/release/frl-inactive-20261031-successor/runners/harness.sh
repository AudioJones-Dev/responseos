#!/bin/bash
set -uo pipefail
mkdir -p /review /review-src /out
tar -xf /in/source.tar -C /review-src
cp -r /review-src/prisma /review/prisma
cp /review-src/docs/release/frl-inactive-20261029/account-transaction.sql /review/account-transaction.sql
cp /in/original-account-transaction.sql /review/original-account-transaction.sql
H=/review-src/docs/release/frl-inactive-20261029
echo "source_sha=$(cat /in/SOURCE_SHA) tree=$(cat /in/SOURCE_TREE) tar_sha256=$(sha256sum /in/source.tar | cut -c1-64) original_template_sha256=$(sha256sum /in/original-account-transaction.sql | cut -c1-64) server=$(su synthetic -c 'psql -h /var/run/postgresql -d postgres -Atc "show server_version"' 2>/dev/null || psql -U synthetic -h /var/run/postgresql -d postgres -Atc 'show server_version')" | tee /out/harness-summary.txt
for h in synthetic-migrations synthetic-account synthetic-concurrency; do
  bash "$H/$h.sh" > "/out/$h.log" 2>&1; echo "$h exit=$?" | tee -a /out/harness-summary.txt
done
createdb -U synthetic -h /var/run/postgresql synthetic_prisma_failure && echo "synthetic_prisma_failure created" | tee -a /out/harness-summary.txt
echo HARNESS_DONE
