# Installer execution review

Status: author technical review and local validation complete for the stated scopes; independent review and hosted execution remain HOLD.

## Confirmed policy behavior

Pinned npm 11.16.0's @npmcli/arborist/lib/arborist/rebuild.js states and implements that an unreviewed allowScripts verdict still runs dependency hooks; only an explicit false verdict blocks them in that phase. The warning observed in earlier installs was therefore not an execution barrier.

A local root-hook fixture corroborates the separate global switch: npm ci --ignore-scripts exits zero without creating its marker; the same fixture's ordinary npm ci exits zero and creates the marker. This establishes the switch behavior for this controlled fixture, not safety of arbitrary npm dependencies.

The proposal now disables automatic hooks for npm bootstrap, verification-tool npm ci, application artifact npm ci and integration npm ci. It executes the repository's version/marker-guarded minimatch compatibility patch explicitly, then the existing Prisma generation/build/test commands. No package/lockfile, advisory threshold or rule is changed. The integration gate requires the --ignore-scripts command arguments and matches compatibility patch source hashes across source/export/platform reports; two new rejection cases bring synthetic controls to 44.

## Inspected source boundaries

The installer-source-inventory.json identifies nine entry points/selected helpers by package version, lock integrity, file size and SHA-256. It is not a claim of complete transitive code review.

| Code path | Observed behavior | Current disposition |
| --- | --- | --- |
| Root minimatch patch | Checks version 10.2.5 and marker; writes CommonJS compatibility export under node_modules | Explicit command retained; source identity added to platform/integration hashes |
| Prisma client hook | Locates CLI/project and spawns generation/version commands | Automatic hook disabled; explicit generation remains |
| Prisma engines hook | Calls fetch-engine downloader; platform/version selection can depend on environment | Automatic hook disabled; generation can still obtain engines |
| Prisma preinstall | Loads a bundled preinstall implementation | Automatic hook disabled |
| esbuild install | Checks installed native binary; fallback can npm-install or download/extract a registry tarball | Automatic hook disabled; platform package consumption during tests still needs platform evidence |
| unrs-resolver hook | Calls napi-postinstall helper | Automatic hook disabled |
| napi-postinstall | Discovers registry and optional package; fallback can install/download native binary | Hook route disabled; do not infer universal runtime non-execution |
| Prisma fetch-engine | Default binaries.prisma.sh mirror, separately fetched zipped/unzipped SHA-256 checks, optional checksum-ignore environment switch | Sanitized child environment does not propagate mirror/checksum-ignore overrides; remote checksum retrieval is not a lockfile-pinned binary identity |

Executing a pinned CLI or build still executes dependency code. Disabling install hooks reduces this boundary but does not create an OS/network sandbox or make a compromised runner trustworthy. Npm package integrity and separately fetched Prisma checksums have different trust origins. Required independent review must address npm bootstrap integrity, explicit generation/engine downloads, runner credentials/filesystem exposure and actual Linux behavior.

## Fresh local validation

A fresh archived local overlay of PR #195, 304f19ccd41e5d5d1356e4875834c0823c7fcf2f, retains PR #195's exact package/lock bytes and adds only PR #198's candidate tracing config. Under Node 24.18.0/npm 11.16.0: script-disabled ci, explicit patch, Prisma generate and production build all pass; lint/types and 668 tests pass; native PNG succeeds; nine HTTP probes pass without observed module escapes. Audit remains five high findings. No DLLs were copied into the package.

Fresh source/dependency trees were used, but inherited workstation cache locations were not fully isolated. Cold-cache npm/Prisma acquisition and Linux/Postgres remain unverified. Evidence is curated in installer-review/raw-evidence.tar.gz with SHA-256 inventory; dependency trees, binary payloads and full builds are excluded.

No hosted workflow, merge, deployment, live provider write, worker activation, advisory exception or PR #195 change occurred. PR #197 and #198 remain draft. Two scoped closure proofs from the preceding review leave 106 UNKNOWN imports; five high findings and 36 matching defects remain independent permanent-remediation blockers.
