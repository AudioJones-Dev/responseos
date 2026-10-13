# Sharp Windows tracing diagnosis

> **Moved from PR #198 on 2026-10-08.** PR #198 was closed unmerged as superseded by #192, which removed `output: "standalone"` from master. The `outputFileTracingIncludes` change described below was never merged, and master's `next.config.ts` doesn't contain it. This file is kept as historical Windows diagnosis evidence. The text below is unchanged from PR #198 head `6ea661e`, so its status lines and its references to "the candidate" and "PR #198" describe that point in time.

Status: packaging candidate only; FAIL / HOLD for cross-platform and independent acceptance.

## Version correction

The original PR #195 and exact-lock overlays use Next.js 16.3.8 and Sharp 0.35.5. Master uses Next.js 16.3.4 and Sharp 0.35.4. These identities were rechecked from installed package manifests and build logs. The initial report incorrectly attributed 16.3.4 to PR #195; its archived observations remain unchanged and contain the authoritative 16.3.8 banner.

## Observed omission boundary

The original Windows PR #195 Turbopack build's next-server.js.nft.json includes the Sharp native addon but neither DLL. Standalone consequently has the addon but not libvips-42.dll or libvips-cpp-8.18.7.dll and fails native execution.

Direct bundled NFT tracing of three entries—the native package index, Sharp's index and Next's next-server entry—includes the addon and both DLLs. Repeating with Next's UTF-8 read override does not remove the DLLs. NFT gives them sharedlib reasons, linked to the native addon. This rejects the hypothesis that NFT cannot detect these Windows DLLs or that the UTF-8 override causes their omission.

A direct isolated recomputation through Next.js 16.3.8's JavaScript collectBuildTraces also emits both DLLs. Original artifacts are unchanged. The diagnostic's attempted NFT export interception was ineffective; only direct emitted traces are used as evidence.

Next's build index selects turbopackBuild for Turbopack and bypasses the JavaScript collector path used for Webpack. This branch is identified by source hashes in the diagnostic. A fresh full build of unchanged PR #195 with the documented npm run build -- --webpack flag includes both DLLs automatically in next-server.js.nft.json and standalone output. All shipped native file hashes match, PNG execution succeeds, nine HTTP probes pass, and lint/types/668 tests pass.

| Windows evidence | Original Turbopack | Candidate Turbopack | Unchanged-source Webpack diagnostic |
| --- | --- | --- | --- |
| Source | 4e1f353 | 304f19c, config-only local overlay | 4e1f353 |
| Next / Sharp | 16.3.8 / 0.35.5 | 16.3.8 / 0.35.5 | 16.3.8 / 0.35.5 |
| DLLs packaged | Missing | Included through 95 route traces | Included through server trace |
| Native PNG | FAIL | PASS | PASS |
| HTTP probes | 9 passed, limited paths | 9 passed, limited paths | 9 passed, limited paths |
| Full audit | Five high findings | Five high findings | Five high findings |

Supported conclusion: the omission is localized to the inspected Windows Turbopack tracing/build path. The deeper implementation cause inside Turbopack's native tracer remains unproven; this is not an upstream source-code defect diagnosis or a claim about all Turbopack platforms/releases. A bundler-level counterfactual is stronger evidence than a negative file scan, but it is not proof of full bundler behavioral equivalence.

## Reproduction and maintenance decision

Use Node 24.18.0/npm 11.16.0 and archive PR #195 4e1f353117696658988bca171e4e0e51c0fb1b96 into an empty checkout. Install with --ignore-scripts, run the guarded repository compatibility patch and Prisma generate, then build with the documented --webpack flag. The captured build runner and raw command reports are inside sharp-tracing-diagnostic/raw-evidence.tar.gz with an inventory and archive SHA-256. Keep mock adapters, authentication required and loopback-only probes; do not deploy.

The source/dependency checkout is fresh, but workstation caches were not fully isolated. The raw archive includes direct tracer diagnostic scripts and emitted traces, build/audit/native/runtime/quality reports, and no dependency tree or binary payload. It preserves the unsuccessful interception attempt transparently. Review the trace outputs as observations, not authenticated evidence from a trusted hosted runner.

The application package script and bundler remain unchanged. This diagnostic does not propose switching the application to Webpack. The narrow explicit DLL include in PR #198 remains the smaller packaging candidate, pending independent/Linux/Postgres acceptance. Route matching, native assets and version identities must be rechecked after Next/Sharp/config changes. Windows arm64, Linux and deployed artifacts remain unaccepted.

No PR #195 modification, hosted dispatch, merge, deployment, live provider write, worker activation or security exception occurred. The five audit findings, 36 glob-task defects and 106 unresolved import obligations remain separate blockers.
