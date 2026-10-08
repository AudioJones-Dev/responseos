# Traced packaging mode (prototype)

Status: EXPERIMENTAL / HOLD. This is a local prototype. It isn't acceptance evidence, and it doesn't authorize hosted execution.

## Why

PR #192 removed `output: "standalone"` from `next.config.ts`. The packaging gates in this proposal copied `.next/standalone` and ran its `server.js`, and that folder no longer exists on master. Without standalone output, the deployable package is defined by the build's `.nft.json` traces. Vercel bundles from those traces.

## What changed

The scripts detect `.next/standalone`. When it exists, the original standalone path runs unchanged, so the frozen `4e1f353` evidence can still be reproduced. When it doesn't exist, they use traced mode:

- `braces-traced-runtime.mjs` lists the traced package: every `.nft.json` entry, the traced entry files and `required-server-files.json` `files`. A traced file outside the checkout is rejected. Links are listed for review.
- `braces-artifact-runtime.mjs` serves the build checkout with `next start` under the existing load hook. It hashes the traced files before and after the run. Next opens its port before it finishes initializing and holds requests until it's done, so the run first waits for a `public/` static file to return 200. The proxy matcher skips paths with a dot, and no application route code loads. Every module file loaded after that response has to be in the traced package (`untracedRequestLoads` must be empty). Earlier loads are recorded as `untracedStartupLoads`. Those belong to the `next start` launcher, which Vercel replaces with its own. The first version used the port opening as the boundary, which was racy: one full-chain run counted seven late launcher loads (`@next/swc`, `next/dist/build/define-env.js` and others) as request loads.
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
- The 44 infrastructure controls, the gate controls and the artifact-analysis controls all pass.

## Traced closure matrix

`braces-closure-matrix.mjs` selects traced mode from `runtime-summary.json` (`packaging: "traced"`). The standalone path keeps its frozen `4e1f353` / `win32` / 140-row identity and archive hash check. A traced run needs a frozen identity file as its fourth argument, `{applicationSha, platform, occurrences, ledgerSha256}`. Without one it stops, and it also stops if any field differs from the bundle or the ledger hash differs. No traced identity is committed yet.

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
- No traced frozen identity is committed. Its rows and closures need independent review before one is.
- No traced evidence set is committed. An application SHA that the reviewer agrees on has to be chosen first.
- `next start` from the build checkout isn't Vercel's launcher. `NEXT_ENABLE_ADAPTER=1 vercel build` output would be closer to the deployed package, but it adds the Vercel CLI to the trust boundary.
- Audit findings and the braces disposition are unchanged.
