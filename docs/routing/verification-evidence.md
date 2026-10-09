# Phase 1 verification evidence

October 9, 2026. Only synthetic data and loopback PostgreSQL 16 were used. No hosted database migration or customer/provider operation was executed.

| Check | Observed result |
|---|---|
| Isolated dependencies | npm 11.16.0 clean installation; package-lock unchanged |
| Unit suite | 701 tests in 59 files passed |
| Existing plus hosted PostgreSQL suite | 213 tests in 18 files passed |
| Final hosted reliability and runtime slice | 21 tests in 2 files passed, including new worker process test |
| Prisma model versus applied local migrations | No difference detected |
| Typecheck, ESLint, Next production build | Passed |
| Production dependency audit | Zero vulnerabilities; existing development advisory policy unchanged |
| Required hosted CI | Linux, Node 24.18.0, PostgreSQL 16/17; see [draft PR #210 checks](https://github.com/AudioJones-Dev/responseos/pull/210/checks) for the exact reviewed SHA |

Local bundled Node is 24.19.0, so local results do not replace exact-runtime CI. Windows process termination is forced; the process test verifies the graceful SIGTERM path specifically on Linux CI.

Reliability tests cover all six plan projections; concurrent receipt persistence; payload-change conflicts; tenant/environment separation; two competing database clients; stale fences and lease expiry; missing acknowledgments; safe nonacceptance/backoff; association readback uncertainty; digest corruption; frozen-plan drift; uncertain retention holds; tenant-scoped audited simulation reconciliation; database scope/fence constraints; and receipt replay across clients and worker processes. Read-only adapter proof tests never issue object creation or association writes and leave absent records inconclusive.

These results establish local simulation behavior. They do not establish HubSpot acceptance, real provider transport/portal binding, hosted backup restoration, external paging, production authentication approval, website integration or production readiness. See operations-and-acceptance.md for the release register and controlled acceptance sequence.
