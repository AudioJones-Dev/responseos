# Local Linux package and inactive watchdog

Status: EXPERIMENTAL, local review only. Accepted application
`8bdd1846c53853d85a220bda2cf5f52071c4be76` and disabled control
`1ff5e37579ecf586ec9dce814fdd57d931350468` remain immutable. The owner authorized
publishing those exact commits to new dedicated branches, not merging master,
changing hosting, issuing credentials, or activating services. The successor
pair remains local pending review. No milestone or activation gate advances.

## Watchdog contract

`RESPONSEOS_GROK_WATCHDOG_MODE` defaults to `inactive`. Explicit `inactive`
returns successfully without loading the database, service or provider modules,
starting a sweep, timer, or network request. This is a one-shot inactive check,
including with `--loop`; it is not a daemon, health heartbeat, monitoring,
termination attempt, or disconnection evidence. Do not supervise this mode with
an unconditional restart loop.

Unknown modes, including an empty string, fail before business imports. Active
mode requires both exact `active` and the existing exact enabled flag `true`.
The existing qualification and termination guards remain in force; this flag
pair is not authority to admit calls. Active-mode synthetic process tests set
both flags explicitly. Subprocess tripwires intercept business-module imports
and network operations, with an active positive control proving the trap runs.

## Packaging contract

On an isolated Linux x64 checkout with the already-approved cached dependencies
and generated Prisma client, run:

```sh
node scripts/package-linux.mjs /work/package-output
```

Requires a clean exact commit, Linux Node 24.18.0, npm 11.16.0, a new external
output directory and disabled checked-in qualification. It rejects local
environment files and rebuilds Next with an allowlisted credential-free
environment and exact source SHA. It performs no installation, migration,
seeding, deployment or provider action. Run it with networking disabled.
The installed Next 16.4 deployment guide supports the existing `next build` /
`next start` server layout; no standalone-output configuration change is needed.

The archive contains an allowlisted source subset, production Next build,
cached Linux dependencies (including development tools for TS entrypoints),
public assets and generated Prisma client. It is intentionally not a minimal
production image. No runtime Node binary is bundled; use the pinned Linux
Node image recorded in external evidence. `PACKAGE.json` records source/tree,
versions, per-file hashes and relative symlinks; the adjacent checksum covers
the archive. Build timestamps may differ between runs; no reproducibility claim.

From the extracted `runtime` directory:

```sh
node scripts/run-linux-package.mjs
node scripts/run-linux-package.mjs web-offline
```

The default runs the inactive watchdog. `web-offline` binds only loopback
port 3000 with auth required and no database/provider credentials. Both modes
discard inherited application variables, tokens and `NODE_OPTIONS`; unknown
modes fail. This launcher cannot select active media/watchdog operation.
Starting the web process is a local packaging smoke test, not hosted readiness.
No active listener, watchdog supervision, or carrier deployment is provided.

## Doctrine section 21 review

1. Runtime safety and operational packaging in the communications layer.
2. Build the small repository-specific inactive entry gate; reuse Next/Node/tar.
3. Makes later pilot review concrete without initiating a pilot.
4. Preserves exact accepted commits and produces source-bound package evidence.
5. Claims only observed local process and test outcomes.
6. No proprietary learning or call data is collected.
7. Uses commodity build tooling rather than creating a hosting platform.
8. Does not duplicate CRM, FSM, telecom or workflow functionality.
9. The Linux archive is provider-independent.
10. Active tenant guards are unchanged; inactive mode performs no tenant reads.
11. Inactive success is explicitly not monitoring or disconnection evidence.
12. No live integration, certification or production-ready claim.
13. No new approval grant; all existing activation and installation gates remain.
14. No new data collection, credentials or compliance claims.
15. Required now by the owner's scoped publication and packaging request.

Withdrawal guards and migrations are unchanged. CRM, email, recording and
automatic transfer remain disabled. Existing limits on withdrawal audio,
remote cancellation, authenticated disconnection and hosted private-network
isolation remain open. Review the external final-tree evidence and matching
disabled-control pin before any later action.
