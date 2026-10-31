# Local validation readout

Tested implementation commit: `8dd7e066d7de40a563b1d5060c9343ec2b909992` (local only). Subsequent evidence documentation and patch whitespace normalization do not change runtime code. Published #231 remains draft at `465a12a2678b84ea3d1cb45572b0bdf49dbd7748`; final remote master readback remains `523e179be338603673f5d8ccbc75dd98391a7dec`.

| Check | Result |
|---|---|
| Lint / typecheck | Passed |
| Unit | 64 files, 876 tests passed |
| PostgreSQL integration | 15 files, 193 tests passed; expanded direct capture/manual memory inactivity checks included |
| Build | Credential-free and synthetic-database builds passed |
| Schema | Integration and restored synthetic schemas: no difference |
| Original-column preservation | Every pre-0009 public table count/hash matches after 0009–0013 + setup migration |
| Full post-migration restoration | 34 table count/hash projections match after restore to fresh synthetic database |
| Failure cases | Duplicate call and webhook unique indexes; final ALTER fault; real Prisma P3018 then P3009; account audit insertion failure |
| Account proposal | Rollback preview, synthetic-only new/compatible-ID commits, collision/refusal/replay tests, exact draft/audit restore passed |
| Cleanup patch | `git apply --check` passed; never applied or deployed |

Log/checksum manifest: [evidence.json](evidence.json). Raw logs and synthetic dumps are retained locally in `evidence/frl-inactive-20261029/`; they are ignored by Git. The full candidate diff is exported there as `local-successor.patch`. No real FRL data was inserted into any test database.

Next/Prisma/Vite emitted existing configuration/deprecation notices; no dependency upgrade was made. Builds warn if the public canonical URL is unset in this isolated environment. The initial fixture-mode unit failure and harness corrections are recorded in the main report; final results above refer to corrected runs.

Self-review completed; no independent reviewer was invoked and no CI was run on the unpublished successor. Synthetic SQL uses local administrative privileges and does not establish production runtime grants, schema/export privileges, storage protection, backup allowance, RPO/RTO or production recovery readiness.

Only task-created containers `frl-release-node-20261029` and `frl-release-db-20261029` were used for execution, with no published ports and network-none/shared-loopback networking. They are stopped and retained with their synthetic evidence. The dependency volume `frl-release-node-modules-20261029` is retained. Existing worktrees, databases and pilot evidence were not modified.

## Correction (2026-10-31)

The statement "Tested implementation commit: `8dd7e066d7de40a563b1d5060c9343ec2b909992`" above is not supported by the retained evidence. The tests ran on the bind-mounted working tree before that commit existed: unit started 11:38:19 EDT and integration 11:38:23 EDT (log clock is UTC), while `lib/clientSetup/service.ts` was last written at 11:42:51 EDT and the commit was made at 11:44:33 EDT. No log records a commit SHA. The results stand as recorded for an uncommitted tree; they do not prove the content of `8dd7e06`. The historical logs are left unchanged. Successor validation from an exported exact-SHA tree is in [../frl-inactive-20261031-successor/README.md](../frl-inactive-20261031-successor/README.md).
