# One-call qualification — disabled release, November 7

EXPERIMENTAL. Runtime `e4101b7324406e33a0cbfd48d041b9a583e1cf9f` is deployed to the isolated pilot only. No live call or admission window was opened. Documentation commits after this runtime do not change the deployed code.

| Component | Evidence |
| --- | --- |
| CI | [42386630165](https://github.com/AudioJones-Dev/responseos/actions/runs/42386630165): exact runtime SHA passed validate and PostgreSQL 16/17/18 integration |
| Vercel | `dpl_BPppczwhBu7jV3Xt6YnZAuuMEDD3`, READY; canonical pilot alias returns exact runtime SHA and preview environment |
| Render primary | `dep-dbnk9vijnfac73ckjhk0`, LIVE 15:35:30 UTC; instance `8rfxc` |
| Render watchdog | `dep-dbnk9vs9v7es73d0t1h0`, LIVE 15:35:24 UTC; instance `t78f8`; disabled startup observed |
| Neon | `dark-lake-70639149` / `br-frosty-lake-aujruc02` / `frl_recorded_pilot`; no schema change |

Both Render build guards pin the runtime SHA and automatic deployments are off. Primary runtime confirms valid existing keypad configuration, matching deployment/database bindings, authentication required, admission false, dispatch false, cleanup true and expired window. An empty-queue cleanup iteration completed without error; this is not a provider deletion test. Qualification configuration and readiness flags have not been installed.

Public checks: health 200, anonymous admin API 404, missing/invalid webhook signatures 401. Authenticated operator console access must be checked in the owner's signed-in session before calling; it was not re-established by anonymous checks.

Before deployment, the isolated account was paused, unresolved runs zero, artifacts zero and deletion tasks zero. Authenticated Telnyx checks confirmed both dedicated applications inactive and both active-call inventories empty. No provider settings were changed during this release. Docker hold and ARO pause remain unchanged; the temporary local PostgreSQL test server was stopped.

## What is ready and what remains

The strict one-call exception, manual exact-call approval, account-wide lockout, immediate local purge and repeated provider absence checks are implemented. Local validation passed lint, typecheck, 977 unit tests, build and 231 integration tests; affected checks were repeated after final adjustments. No live speech or retention claim follows from synthetic tests.

Next, agree a fresh supervised capture-off window to establish active manual termination and controlled primary-worker failure recovery. Verify endpoint separation, provider defaults/routing, fresh watchdog scans and console access. These checks are required before setting the corresponding recorded-mode evidence flags.

Then configure one five-minute, one-candidate spoken qualification window with retention and withdrawal explicitly unverified. Use synthetic content, approve the matching pending call, give spoken consent, complete the bounded name/operator stages and test spoken withdrawal. Close admission and retain signed ingest and cleanup through the 24-hour observation period. Any failure stops progression; the durable qualification claim never automatically reopens.

Report observed local purge and authenticated provider metadata absence separately from unknown recognition storage and backup erasure. The owner-approved engineering inquiry is sent, but no provider guarantee has been received. A single call does not establish the full success/refusal/no-answer/outage suite or client readiness.
