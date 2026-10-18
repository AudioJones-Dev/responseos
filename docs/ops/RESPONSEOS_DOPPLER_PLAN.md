# Doppler integration: disabled local plan

Status: owner-authorized local scaffolding only. Existing runtime, Doppler mapping, GitHub consumers and Vercel settings are unchanged. `infra/doppler-plan.json` is non-secret inventory/proposal metadata, not a provider sync definition. `node scripts/validate-doppler-plan.mjs` validates it offline and has no execution or synchronization code. The node:test suite is `node --test tests/scripts/doppler-plan.test.mjs`.

## Current evidence and explicit mapping

| Use | Doppler source evidence | Destination / authority |
|---|---|---|
| Optional local development | `response-os/dev` in committed doppler.yaml | Existing `dev:doppler`, `build:doppler`, `start:doppler` use CLI runtime injection; config existence verified by metadata-only CLI listing; secret contents, scope and use unverified. |
| Historical mock-demo DB | `response-os/stg_staging_demo` in July4 checkpoint | Config existence verified; historical database validation is not FRL binding evidence. Do not reuse for FRL without separate scope review. |
| Qualification runtime proposal | **Unset** until owner selects a dedicated scoped source | Vercel team `team_BHxIkAGPW6qEKKQBAt9c0NGz`, project `prj_Pm88ysh24EgV1DEIcvaE9r2Xd28A` / `responseos-frl-live-demo`, custom environment `env_k4aq29aq3e4XqcKuaNyRYyOJ7YkV` / `frl-live-demo`. Current binding/sync origin unverified. |
| Qualification release proposal | **Unset** until owner selects a separate scoped source | GitHub `AudioJones-Dev/responseos`, Environment `live-demo-staging` only. No repository-wide or organization-wide sync. |
| Production | Excluded | No source, destination or authorization proposed. |

Installed Doppler CLI reports3.76.6. No authentication state, local secret file or secret values were inspected. Repository docs say Doppler is optional; normal process environment and local env-file use remain supported. Workflow `secrets.*` references prove consumption, not whether values are manually maintained or synced. Provider metadata is required to determine source of truth.

## Proposed separation

The proposed runtime source would contain only the exact authentication/database names and non-secret settings in the manifest. The proposed release source would contain deployment token/bypass and the deployment job's database references, separate from runtime. The existing workflow maps `LIVE_DEMO_DATABASE_URL` to process `DATABASE_URL` and `LIVE_DEMO_DIRECT_URL` to `DIRECT_URL`; a future sync source must use the destination names and approved values. Do not rely on an unverified renaming feature.

The allowlist is a proposal, not proof of least privilege of existing credentials. Database role/schema, Clerk application/org and Vercel token scope must match the separately approved qualification lane. Do not inject a broad dev/prod config or a deployment token into the application. Exclude TELNYX_API_KEY, HUBSPOT_ACCESS_TOKEN, RESEND_API_KEY and other provider credentials from offline qualification. Live flags must remain explicitly false and auth required under the existing qualification preflight. Later carrier qualification needs its own authorization and configuration review; this plan does not enable it. No fingerprint key name or value is invented.

The validator deliberately rejects activation, invented source configs, unverified sync claims, extra fields/value dictionaries, broad destinations and extra secret names. Real wiring requires a reviewed manifest revision and action-time permission; changing a JSON boolean alone cannot make this script execute anything.

## Operator steps and next approval batch

1. Supply only non-secret metadata: approved Doppler project/config per proposed lane, existing sync IDs/status/last-success time if any, exact Vercel destination and GitHub Environment, selected variable names, credential scope/role descriptions and rotation owner. Confirm whether an integration already exists before proposing another. No secret export or auth-file inspection.
2. Verify provider-side support for **that exact Vercel custom environment**, and GitHub Environment-scoped sync in this repository/account. The official sync API documents a custom environment ID as target_id; the authenticated integration options must still confirm this exact project/environment. Stop if unavailable; do not substitute Preview/Production, broaden scope or silently create an alternative synchronization mechanism. Review the interaction of Vercel secret-variable visibility and the existing commissioning pull/preflight; no assumption that secrets can be read back.
3. Before any login/OAuth grant, token creation/install, persistent access, credential rescoping or external sync, obtain exact action approval. Batch must name source project/config (currently unresolved), destination IDs above, names/data categories, permissions, duration/rotation owner, trigger risk and rollback. Runtime categories: database connection credentials and Clerk auth/webhook credentials. Release categories: Vercel deployment token/bypass plus designated DB references. No production/provider-effect credentials.
4. Minimum intended permissions: a runtime injector may read only its approved config; a sync integration may read the selected source and write only the specified destination's environment variables/secrets. GitHub authorization must be limited to this repository and the approved Environment delivery scope. Vercel access must be limited to the approved project/custom environment where supported. Actual provider permission screens must be reviewed; do not assume the requested least privilege is available. Stop on broader grants, new terms or costs.
5. The human performs any required secret entry/transmission through the provider's secure UI or approved secret channel. Never paste tokens into chat, CLI arguments, workflow inputs or exported env files. Do not use a GitHub workflow to export all existing secrets. Existing working credentials are not deleted/replaced. If Doppler lacks an existing source value, decide secure entry or separately approved rotation before cutover.
6. After authorization only, configure the narrowly scoped sync through the verified provider integration. Check whether variable changes trigger deploys before touching it; auto-deploy must not be assumed disabled. Record names, destinations, sync status and timestamps without values. No sync activation is authorized by this runbook.
7. Validate the existing qualification contract without disclosure, retain human-reviewed release controls, and separately approve any hosted commissioning. Disabling or changing a sync can itself alter destination secrets; review rollback before enabling, do not blindly delete/recreate. Doppler becomes the declared source of truth only after verified ownership and sync evidence.

Existing local CLI injection can be selected explicitly as `doppler run --project response-os --config dev -- npm run dev` **only after scoped access/use is authorized and confirmed**. It has not been run in this task. No new launcher or CI Doppler token was added. Production and qualification do not inherit this development command.

## Official references checked October18

- [Doppler Vercel integration](https://docs.doppler.com/docs/vercel): documents authorization, target selection, per-environment sync and variable visibility; its overview is supplemented by the sync API, which explicitly accepts custom environment IDs. It also warns that env changes can trigger deployments. No deletion/recreation guidance was executed.
- [Doppler GitHub Actions integration](https://docs.doppler.com/docs/github-actions): documents chosen repository/Environment delivery and one-way sync; hidden GitHub values cannot be read back through the ordinary API. We do not adopt its broad secret-export example.
- [Doppler service tokens](https://docs.doppler.com/docs/service-tokens): reference for future scoped machine access only. No token was created or inspected.

These public docs establish capabilities, not the state of the owner's integrations. Synthetic schema tests and isolated Vercel41.7 help checks remain credentialless and independent of this proposal.

Consumer alignment: NEXT_PUBLIC_APP_URL must match the pinned managed alias URL under the existing orchestrator. VERCEL_ORG_ID and VERCEL_PROJECT_ID are nonsecret identifiers, but the current GitHub workflow reads secrets.*, so deliver them as Environment secrets, not Actions variables. The manifest names this storage requirement explicitly; changing to vars.* needs a separately reviewed workflow change.

## Metadata readback and custom-environment capability

A metadata-only CLI listing succeeded using existing authorization after sandbox access was permitted. It returned response-os configs dev, dev_personal, dev_local-audio-config, stg, stg_staging_demo, prd and prd_demo_prod. Only name/project/environment/root fields were retained. No secret values, auth files, tokens or login were inspected or created. Config existence does not establish credential scope, sync ownership or FRL suitability; qualification sources remain unset.

The [official sync API](https://docs.doppler.com/reference/syncs-create) explicitly permits a custom environment ID for Vercel target_id. Proposed target_id is env_k4aq29aq3e4XqcKuaNyRYyOJ7YkV, never the slug or Preview/Production fallback. GitHub delivery uses feature=actions, sync_target=repo, repo_name=AudioJones-Dev/responseos, environment_name=live-demo-staging and sync_unmasked_as_variables=false to match existing secrets.* consumers. These are proposed API parameters only; no request was sent. The existing CLI has no integration/options listing command, and no token was extracted for direct API use. Remaining non-secret inputs are actual integration IDs, exact target options, source config selection, credential-scope metadata and sync status.

No-effects qualification here means an offline/deployment-safe configuration. It is not an operational phone-call rehearsal: later carrier rehearsal requires separately authorized carrier credentials/routing and live-effect gates.