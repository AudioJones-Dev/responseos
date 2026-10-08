# Sharp standalone packaging repair

Status: Windows packaging candidate validated locally; FAIL / HOLD for cross-platform, independent review and security acceptance.

## Change and evidence

Next.js 16.3.8 Turbopack standalone output omitted both Windows Sharp DLLs from the original PR #195 artifact. Its installed Sharp 0.35.5 tree produced a PNG; standalone failed with ERR_DLOPEN_FAILED. The native addon statically imports libvips-42.dll and libvips-cpp-8.18.7.dll.

The candidate adds a narrow outputFileTracingIncludes pattern for node_modules/@img/sharp-win32-*/lib/*.dll to all server route traces. Next.js's installed output configuration guide documents this mechanism for native assets. The build now includes both DLLs in 95 route traces and copies them into standalone output. No DLL was manually inserted. All three shipped native files match the installed package SHA-256 hashes on each tested snapshot.

Direct bundled @vercel/nft tracing of the native package index includes both DLLs even before this change. Therefore the evidence does not support claiming that NFT cannot recognize Windows DLL dependencies. The omission is now localized to the inspected Windows Turbopack path; see [tracing diagnosis](sharp-windows-tracing-diagnosis.md). Its deeper native tracer implementation cause remains unresolved. Explicit inclusion is a supported configuration correction; its maintenance obligation is to revalidate native asset selection after Next.js or Sharp upgrades.

| Gate | Master candidate | PR #195 exact-lock local overlay |
| --- | --- | --- |
| Application source | 5ebe72339a66dbb1f9bdfd36228ae14ecd6b1a5c | 304f19ccd41e5d5d1356e4875834c0823c7fcf2f |
| Base | 3252a6de9c8a40992b3edc655c05ffbe73459194 | 4e1f353117696658988bca171e4e0e51c0fb1b96 |
| Next.js | 16.3.4 | 16.3.8 |
| Sharp | 0.35.4 | 0.35.5 |
| Fresh npm ci / generate / production build | PASS | PASS |
| Shipped native hash closure / PNG operation | PASS | PASS |
| Loopback HTTP / affected loads / module escapes | 9 passed / 0 / 0 | 9 passed / 0 / 0 |
| Lint / typecheck / unit tests | PASS, 660 tests | PASS, 668 tests |
| Full dependency audit | FAIL, 11 findings: 1 critical, 8 high, 2 moderate | FAIL, 5 high findings |
| Linux / Postgres / independent review | NOT EXECUTED | NOT EXECUTED |

The overlay is a local-only Git commit containing exactly next.config.ts over the unchanged PR #195 source. Neither PR #195 nor its package files or lockfile were modified. Node 24.18.0 and npm 11.16.0 were used. The config wildcard is intended to select installed Windows native packages; Windows arm64 and other packaging targets have not been accepted.

## Reproduction

Use the pinned verification tooling from PR #197 commit 36926184ff55ce8befa56efc208f99f2e97356f1 in its isolated checkout. Import the candidate Git object locally and set SECURITY_APPLICATION_SHA to the immutable candidate commit. Set SECURITY_NPM_CLI to npm 11.16.0's npm-cli.js and use Node 24.18.0. Run braces-artifact-build.mjs, braces-artifact-inspect.mjs and braces-artifact-runtime.mjs from scripts/security. The builder archives the source to a fresh checkout and builds with mock adapters and authentication required. The runtime verifier materializes build output, tests native image execution and probes nine routes without deployment.

Copy the committed native-closure.cjs.txt to a temporary native-closure.cjs file and run it with the artifact-verification evidence directory. It reads the source/runtime paths in build-summary.json and runtime-summary.json, inventories all shipped DLL/node files, parses static/delay PE imports, runs direct NFT tracing, and compares installed versus standalone hashes. Temporary build directories must still exist or be recreated. Run lint, typecheck and test in that fresh checkout; the source and command results are preserved in the archive.

The raw archive retains original failure evidence and both candidate snapshots, with hashes in archive.json. It excludes dependency trees, DLL binaries, complete builds and credentials. Native DLL execution can involve OS libraries or dynamic loading beyond JavaScript hooks; static PE closure and a single PNG operation do not prove every native format or platform path. Nine HTTP paths do not establish universal runtime absence of braces.

## Integration decision

Keep this packaging repair separate from PR #197's verification infrastructure and PR #195's dependency remediation. Require independent review and clean Linux/Postgres acceptance before merge consideration. Rebuild and repeat exact-lock/native/security/compatibility gates after any dependency or source change. The five high audit findings and 36 glob-task defects remain blockers; this configuration change does not address them. No hosted dispatch, merge, deployment, worker activation or live provider write is authorized by these results.
