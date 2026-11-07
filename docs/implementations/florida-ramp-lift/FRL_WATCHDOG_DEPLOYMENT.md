# Independent watchdog deployment proposal

Prepared 2026-11-06; not created or deployed. Implements the accepted FRL-PILOT-003 failure model. A second Render worker is separate from the primary process/database but shares Render platform risk. Owner approval is needed for its additional charge and access to the dedicated expiring Telnyx account credential.

| Setting | Proposed value |
| --- | --- |
| Service | responseos-frl-pilot-watchdog |
| Type | Background worker, native Node, one instance |
| Workspace | Existing approved pilot Render workspace |
| Compute | 0.5 CPU / 512 MB, listed $7/month additional; verify checkout before creation |
| Source | AudioJones-Dev/responseos, codex/frl-recorded-pilot |
| Node / npm | 24.18.0 / 11.16.0, matching primary worker |
| Build | Exact approved RENDER_GIT_COMMIT comparison, then npx --yes npm@11.16.0 ci --include=dev and npx prisma generate |
| Start | node --import tsx scripts/frl-pilot-watchdog.ts |
| Automatic deploys | Off |
| Initial enable/apply flags | Both false; disabled process remains idle |
| Disk / database / broker | None |
| Credential | Existing dedicated expiring pilot key, only after approved extension to this runtime; no key in build arguments or logs |

Before creation, record the validated source SHA in the build comparison; never use a moving branch as the release guard. Install only the variables listed in FRL_INBOUND_DURATION_AMENDMENT.md. Leave config absent and flags false initially. Do not copy the primary worker's environment wholesale.

After deployment, verify the exact SHA, disabled startup message, absence of crash loops and zero provider commands. Deployment LIVE is not watchdog qualification. In an approved capture-off commissioning window, install matched application/window/release bindings, verify observe-mode inventory, then authorize apply-mode qualification. Maintain separate logs for primary and watchdog; never roll both during an admitted call. A watchdog restart conservatively terminates active pilot calls.

Background workers do not receive Render HTTP health probes. The supervising operator must monitor fresh successful scan output and close admission/manual-stop on gaps. Count-only logs and provider terminal evidence must establish actual behavior. No automatic cross-runtime admission-health interlock is claimed.

Sources checked: [Render pricing](https://render.com/pricing), [deploy controls](https://render.com/docs/deploys), [health-check service scope](https://render.com/docs/health-checks). Approval of this proposal does not authorize live recording or set readiness flags.
