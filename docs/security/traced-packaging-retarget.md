# Traced packaging mode (prototype)

Status: EXPERIMENTAL / HOLD. This is a local prototype. It isn't acceptance evidence, and it doesn't authorize hosted execution.

## Why

PR #192 removed `output: "standalone"` from `next.config.ts`. The packaging gates in this proposal copied `.next/standalone` and ran its `server.js`, and that folder no longer exists on master. Without standalone output, the deployable package is defined by the build's `.nft.json` traces. Vercel bundles from those traces.

## What changed

The scripts detect `.next/standalone`. When it exists, the original standalone path runs unchanged, so the frozen `4e1f353` evidence can still be reproduced. When it doesn't exist, they use traced mode:

- `braces-traced-runtime.mjs` lists the traced package: every `.nft.json` entry, the traced entry files and `required-server-files.json` `files`. A traced file outside the checkout is rejected. Links are listed for review.
- `braces-artifact-runtime.mjs` serves the build checkout with `next start` under the existing load hook. It hashes the traced files before and after the run. Next opens its port before it finishes initializing and holds requests until it's done, so the run first waits for a dotted `public/` file to return 200. The proxy matcher skips dotted paths, so no application route code loads. The run stops if `public/` has no dotted file. Every untraced module load fails the run (`untracedRequestLoads` must be empty), with one exception: files on the `next start` launcher allowlist in `braces-traced-runtime.mjs`, and only before the warm-up response. Those are recorded as `untracedStartupLoads`. The allowlist names `next/dist/{bin,cli,build,lib,compiled,trace,telemetry}/`, `@next/swc-*/` and five exact files (`next/dist/server/next.js` and four in `next/dist/shared/lib/`). It was taken from the 88 launcher loads observed on Next 16.3.4 and must be rechecked after Next upgrades. Vercel replaces this launcher with its own.

  Two earlier boundaries were too loose. The port opening was racy: one full-chain run counted seven late launcher loads as request loads. Ending the window at the warm-up response, as #203 did, would have excused any untraced module first loaded while serving the warm-up file (Codex review on #203). The allowlist closes that gap, except for a launcher file that request handling also needs; that file is excused only if it first loaded before the warm-up response.
- `braces-artifact-inspect.mjs` also scans traced files outside `.next`.
- `braces-packaging-closure.mjs` reads Next's config from `.next/required-server-files.json`.
- The out-of-package control in `braces-artifact-analysis.test.mjs` asserts that a `braces` load from the checkout is reported as untraced. In traced mode the hook can't block it, because the runtime root is the checkout.

Copying the traced files into a separate folder doesn't produce a runnable server. Non-standalone traces leave out parts of `start-server`'s and `router-server`'s import graphs (for example `lib/get-network-host` and `compiled/find-up`). For that reason the prototype checks loads against the traced package instead of copying it.

## Local Linux run

Run with Node 24.18.0 and npm 11.16.0 against master `0ed7cf0` (Next 16.3.4), from a fresh `git archive` export, a hook-disabled `npm ci` and the explicit patch:

- The traced package has 98 trace files, 1,621 files and one materialized link (`.next/node_modules/@prisma/client-*`).
- Routes returned `200` for `/api/health`, `/`, `/demo/receptionist` and `/demo/client-dashboard`; `307 → /` for `/admin`, `/client/dashboard`, `/api/accounts` and `/api/auth/session`; and `404` for the missing route. The health `build_sha` matched.
- The native Sharp probe passed. There were no escapes, no changed traced files and no braces, micromatch, fast-glob or Next ESLint loads.
- No untraced request loads. There were 88 untraced startup loads, all `next/dist/{bin,cli,build,lib,compiled,trace,telemetry,shared,server}` and `@next/swc-linux-x64-gnu`.
- Inspect found no affected packages and no missing or affected trace entries. Name-only mentions appeared in `.next/server/chunks`, `@prisma/client` runtime, `next/dist` and `react/cjs`, with no implementation markers.
- The closure ledger has 116 occurrences, all UNKNOWN, with none missing (36 platform-specific, 27 framework-alias, 5 optional, 48 dynamic), and `packagingPass` is false. This count doesn't compare with the frozen Windows `4e1f353` ledger's 140 IDs.
- The infrastructure controls (44 at the time, 67 now), the gate controls and the artifact-analysis controls all pass.

## Traced closure matrix

`braces-closure-matrix.mjs` selects traced mode from `runtime-summary.json` (`packaging: "traced"`). The standalone path keeps its frozen `4e1f353` / `win32` / 140-row identity and archive hash check. A traced run needs a frozen identity file as its fourth argument, `{applicationSha, platform, runtimePlatform, occurrences, ledger, ledgerSha256}`. `ledger` is a committed frozen closure ledger under `docs/security/`. The run stops in any of these cases:

- the file is missing, or the ledger path is outside `docs/security/`
- the ledger hash or application SHA differs, or any field differs from the bundle
- the native platform the probe selected isn't `runtimePlatform`, for example `linux-arm64` against a `linux-x64` identity
- the fresh build's own ledger rows differ from the frozen rows in any way: added, removed or changed (both reviews on #205)

Like the standalone path, the matrix then matches every frozen row's source hash and AST position against the fresh build. The identity check and both closure rules live in `braces-closure-rules.mjs`, and 23 infrastructure controls cover them: valid identity, outside or traversing path, hash, SHA, platform and count mismatches, added, removed, changed and missing fresh rows, runtime platform, plus active, inactive, shared-label, default and Linux-guard cases, the launcher allowlist, and allowlisted and other files on both sides of the warm-up boundary (`classifyUntracedLoads`, shared with the runtime script). Seven deliberate breaks of these checks each fail the controls.

## Frozen traced identity: linux-x64, master `0ed7cf0`

`docs/security/traced-closure-evidence/linux-x64-0ed7cf0/` holds the frozen ledger (116 rows) and `frozen-identity.json`. They were committed on 2026-10-08 at the repository owner's direction, before independent review. This is an identity only. It isn't acceptance or closure, and it doesn't mean anyone reviewed the 116 rows or their decisions.

Reproducibility: two separate full `braces-ci.mjs` runs on Linux (Node 24.18.0, npm 11.16.0), each with a fresh export, install and build in its own checkout, produced identical ledger rows. Their summaries differed only in `capturedAt`. The committed ledger is from the first run. Run against the second run's bundle, the matrix reproduces 4 `CLOSED_SOURCE_FILE_EXCLUDED`, 28 `CLOSED_INACTIVE_PLATFORM_BRANCH` and 84 UNKNOWN. These changes each stop the run: editing the committed ledger, an edited ledger with a matching hash (caught by the source/AST match) and a ledger path outside `docs/security/`. After the review fixes, a third independent fresh build passed with every untraced load on the launcher allowlist (88). Run against that build, the matrix with the updated identity, which adds `runtimePlatform: "linux-x64"`, produced the same 116 per-row decisions as before. The ledger file and its hash are unchanged.

```sh
node scripts/security/braces-closure-matrix.mjs .security-evidence .security-evidence/closure-review docs/security/traced-closure-evidence/linux-x64-0ed7cf0/frozen-identity.json
```

The evidence bundle itself isn't committed or archived; rerun `braces-ci.mjs` with `SECURITY_APPLICATION_SHA=0ed7cf0b41c309322408f104f68941ff47df2627` to recreate it. Windows and other platforms need their own frozen identities.

```sh
node scripts/security/braces-closure-matrix.mjs .security-evidence .security-evidence/closure-review frozen-identity.json
```

The two existing closure rules keep their exact source checks, using the native platform the probe selected instead of `win32-x64`. Closed inactive branches from a platform other than Windows are recorded as `CLOSED_INACTIVE_PLATFORM_BRANCH`. The false-Linux-guard proof applies only when the selected platform isn't Linux, and in traced mode it doesn't depend on fixed IDs. The native comparison now covers `@img/sharp-<platform>/lib` and `@img/sharp-libvips-<platform>/lib`, and it lists installed native files the package leaves out. That is the class of omission PR #198 hit on Windows standalone.

The rewritten Windows rules accept the same sources and paths as the originals. I checked this against sharp 0.35.5 and 0.35.4 `dist/sharp.{cjs,mjs}`, a mutated `case` label and near-miss paths. The standalone path can't be rerun on Linux, because its preserved checkout paths are Windows paths.

Full `braces-ci.mjs` chain on Linux against master `0ed7cf0` (Node 24.18.0, npm 11.16.0): the Linux job, diagnostics and hostile checks pass. The audit reports 11 findings and the compatibility tasks pass 548/584. Acceptance rejects the bundle for the known reasons. Inside the build step, `npm audit` reached the registry only after the pinned Node install's global `npmrc` was pointed at this container's CA bundle. The build passes only an allowlisted environment, so the CA setting doesn't reach it.

The traced matrix from that bundle has 116 rows on `linux-x64`: 4 `CLOSED_SOURCE_FILE_EXCLUDED` (`.next/build`), 28 `CLOSED_INACTIVE_PLATFORM_BRANCH` (the 14 other-platform `case` targets in `sharp.cjs` and `sharp.mjs` each) and 84 UNKNOWN. Overall packaging closure is UNKNOWN. No installed native file is missing from the traced package. The false-Linux-guard rule closes nothing on Linux. Each of five negative controls stops the run: no identity file, a wrong ledger hash, a wrong row count, a wrong application SHA and a wrong platform.

## Standalone path on Linux

PR #195's head `4e1f353` still builds standalone output, and it built from a fresh export on Linux. Both the original and the changed runtime script stop at the same symlink check: `Runtime link needs explicit review: …/.next/node_modules/@prisma/client-*`. So the standalone path behaves as before. This symlink check is an existing Linux limitation and needs a reviewer decision. It wasn't caused by this change.

## Not done

- Windows run, Linux/Postgres integration and hosted execution.
- The linux-x64 frozen identity for `0ed7cf0` was committed before independent review. Its 116 rows and their decisions still need that review.
- No traced evidence bundle is archived, and there's no Windows traced identity.
- `next start` from the build checkout isn't Vercel's launcher. `NEXT_ENABLE_ADAPTER=1 vercel build` output would be closer to the deployed package, but it adds the Vercel CLI to the trust boundary.
- Audit findings and the braces disposition are unchanged.
