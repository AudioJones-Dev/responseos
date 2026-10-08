# Traced packaging mode (prototype)

Status: EXPERIMENTAL / HOLD. This is a local prototype. It isn't acceptance evidence, and it doesn't authorize hosted execution.

## Why

PR #192 removed `output: "standalone"` from `next.config.ts`. The packaging gates in this proposal copied `.next/standalone` and ran its `server.js`, and that folder no longer exists on master. Without standalone output, the deployable package is defined by the build's `.nft.json` traces. Vercel bundles from those traces.

## What changed

The scripts detect `.next/standalone`. When it exists, the original standalone path runs unchanged, so the frozen `4e1f353` evidence can still be reproduced. When it doesn't exist, they use traced mode:

- `braces-traced-runtime.mjs` lists the traced package: every `.nft.json` entry, the traced entry files and `required-server-files.json` `files`. A traced file outside the checkout is rejected. Links are listed for review.
- `braces-artifact-runtime.mjs` serves the build checkout with `next start` under the existing load hook. It hashes the traced files before and after the run. Every module file loaded after the port opens has to be in the traced package (`untracedRequestLoads` must be empty). Loads before the port opens are recorded as `untracedStartupLoads`. Those belong to the `next start` launcher, which Vercel replaces with its own.
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

## Standalone path on Linux

PR #195's head `4e1f353` still builds standalone output, and it built from a fresh export on Linux. Both the original and the changed runtime script stop at the same symlink check: `Runtime link needs explicit review: …/.next/node_modules/@prisma/client-*`. So the standalone path behaves as before. This symlink check is an existing Linux limitation and needs a reviewer decision. It wasn't caused by this change.

## Not done

- Windows run, Linux/Postgres integration and hosted execution.
- `braces-closure-matrix.mjs` stays tied to the frozen `4e1f353` standalone ledger. A traced ledger needs its own frozen identity and review.
- No traced evidence set is committed. An application SHA that the reviewer agrees on has to be chosen first.
- `next start` from the build checkout isn't Vercel's launcher. `NEXT_ENABLE_ADAPTER=1 vercel build` output would be closer to the deployed package, but it adds the Vercel CLI to the trust boundary.
- Audit findings and the braces disposition are unchanged.
