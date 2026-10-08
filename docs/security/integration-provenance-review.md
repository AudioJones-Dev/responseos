# Integration provenance and scoped closure follow-up

Status: FAIL / HOLD; implementation-author evidence only.

The integration proposal now records nine exact commands: npm ci, Prisma generation, server version, shadow database creation, migration diff, migration deploy, seed, integration tests and DB-backed build. It validates exported package/lock bytes against git source blobs, records initial/final SHA-256 hashes, Node/npm identity, command arguments/exits/timestamps/raw logs, and observes PostgreSQL 16 through SHOW server_version_num. The runner uses an explicit child environment allowlist and fixed loopback synthetic database credentials.

An always-uploaded integration bundle is required by the final gate. The gate checks complete inventory and hashes, refuses links/path traversal, requires exactly one integration report, verifies command records against their raw results, and matches source/lock/tool identity against both platform bundles. GitHub integration job success remains necessary but is no longer sufficient. These controls establish report consistency; they do not authenticate a compromised runner or prove hosted integration has executed.

The synthetic control suite now has 42 passing checks. Thirteen new cases reject missing/duplicate integration reports, corrupt/missing command logs, incomplete commands, mismatched source/lock/tool identities, lock modification, contradictory exits, unsupported PostgreSQL, arbitrary commands, and differing Windows/Linux lockfiles. The runner also rejected this Windows host with exit 1, zero commands and an incomplete report. This is a rejection check, not Linux/Postgres acceptance.

The unused braces-reachability.mjs was removed from active tooling. Its source remains in Git history at df81faceb35436d2a9a7f9fb5e6239216b3ab323. The frozen matcher, original evidence and all occurrence IDs remain preserved.

## Narrow Windows closure

The generator rechecked the original archive and source/runtime hashes, retaining all 140 IDs. IDs 116 and 134 import a Linux libvips package only under isLinux && /(symbol not found|CXXABI_)/i.test(messages). Their source derives isLinux from ["linux", "darwin", "win32"].map((os) => runtimePlatform.startsWith(os)). The verified selector is win32-x64; isLinux is false. The supplemental proof records the exact source hash, guard and selector sources for each row.

This closes those two call-site obligations only for the inspected Windows x64 package, even on its original native-load failure path. It does not close Linux behavior or other Sharp fallbacks. The original matrix remains unchanged; scoped totals are now 4 excluded build occurrences, 28 inactive platform cases, 2 inactive Linux guards and 106 UNKNOWN. The supplemental JSON links the original matrix hash and changed rows. Native packaging failure remains in the original artifact; PR #198 is a separate proposed repair.

## Remaining approval obligations

Installation scripts/npm bootstrap still require exact-source/integrity review and an accepted runner isolation design. Immutable action/image references have been added, but hosted runner labels remain mutable and the proposal is not a network sandbox. Artifact retention remains 14 days pending independent review. No hosted workflow was dispatched. Linux/Postgres and independent review remain unexecuted.

Require an independent human reviewer before approving hosted execution. Do not treat these synthetic tests as real integration success. PR #195 remains unchanged; five high audit findings and 36 compatibility defects remain blocked. No merge, deployment, provider writes, workers or security exceptions occurred.

Later installer update: [installer-execution-review.md](installer-execution-review.md) documents disabled automatic hooks, an explicit source-hashed compatibility patch, 44 synthetic controls and fresh Windows validation. The integration plan now has ten commands including that explicit patch. Independent review and Linux/Postgres remain pending.
