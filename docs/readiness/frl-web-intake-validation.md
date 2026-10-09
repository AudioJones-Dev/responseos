# FRL web intake local validation

October 8, 2026. Base: ResponseOS master `26da408`.

| Check | Result |
| --- | --- |
| ESLint / TypeScript | Passed |
| Full unit suite | 676 passed, including 6 new FRL schema cases |
| Full Postgres integration suite | 170 passed in 14 files, including 7 new receipt cases |
| Production build without database configuration | Passed |
| Prisma generation / local migration deployment | Passed |
| Migration-to-schema parity using isolated shadow database | No difference |
| Repository environment contract | Passed |
| Production-only dependency audit | Zero findings |
| Full dependency audit during install | Five inherited high development-tooling findings; no audit policy changed |

All database operations ran on the new disposable loopback Postgres cluster at
port 55434, database `frl_web_intake_test`, with synthetic fixtures. No hosted
database or provider was contacted. A first migration attempt lacked DIRECT_URL
and stopped before DDL; setting it to the same local database corrected setup.
The first broad unit run lacked Git Bash on PATH; adding the installed Git Bash
path resolved all three workflow syntax checks without test/source changes.
Local Node is 24.19.0 versus the repository's 24.18.0 pin; npm used 11.16.0.

Receipt tests prove: structured professional payload persistence; exact replay
without another audit event; five concurrent calls yielding one row/reference;
changed-content conflict and stable parsed key order; environment/new-ID separation;
account selection and role failures; 90-day expired payload purge preserving replay
identity; and SQL refusal of delivery activation.

Not proved: cross-process kill/restart recovery, populated rollback/restore,
authenticated website ingress, HubSpot dispatch, notification queue/retry,
uncertain-delivery reconciliation, new-contact creation, hosted activation or
end-to-end delivery. There is no public route or provider dispatch in this increment.
This does not implement the complete website retry coordinator adapter. Delivery
is blocked and the website's existing route is unchanged.

Implementation scope and architecture review:
[FRL website receipt foundation](../product/frl-web-intake-receipts.md).
