# ResponseOS GTM and prospect-demo deployment runbook

**Status:** Repository contract only. No platform resource, credential, provider, deployment, phone routing, or prospect release is authorized by this document.

## Isolation contract

| Lane | Vercel project | GitHub Environment | Providers | Public live number |
| --- | --- | --- | --- | --- |
| Mock staging | `responseos-staging-mock` | `staging` | No provider credentials; all adapters mock | Never |
| Supervised live demo | `responseos-frl-live-demo` / custom environment `frl-live-demo` | `live-demo-staging` | Qualification has no CRM/email effects; later pilot requires separate authorization | Hidden until final go/no-go |

Both projects use Node `24.18.0`, distinct Neon databases, distinct Clerk applications/org mappings, environment-scoped Vercel credentials, and manual exact-SHA workflows. Do not link either workflow to the existing `audiojones/responseos` production project.

## Gate A — mock staging

1. Create the isolated Vercel, Neon, Clerk, and GitHub Environment resources.
2. Configure a required reviewer on `staging` and keep provider credentials and live enable flags absent.
3. Run `Deploy Staging` from current `master` with `confirm=staging`, the exact current workflow-control SHA, and the separate reviewed 40-character application SHA.
4. Verify `/api/health` reports that SHA, `/demo` is public, protected routes disclose no application content, invalid Clerk signatures make no mutation, and the mapped test user resolves to only its tenant.
5. Exercise rollback to the prior Vercel artifact and record the artifact IDs and timestamps.

## Gate B — public prospect intake

Keep `RESPONSEOS_PUBLIC_AUDIT_INTAKE_ENABLED` false until Vercel WAF has a path-scoped rule for `/api/audit-requests`, bot controls are active, and an operator captures a real HTTP `429`. Then set the flag, submit once with a fixed `Idempotency-Key`, replay it, and verify one persisted `ProspectIntake` reference. Notifications contain the reference only.

## Gate C — supervised live demo

1. Obtain separate hosted commissioning approval for the pinned application, intended database/role/schema, migrations and rollback, auth, approved facts/disclosure, number/routing, recipient and callback expectations. Use the Voice API Call Control design. Manual operator summary/qualification remains the first demonstration path; the deterministic analysis stub is not model analysis.
2. Review the local target contract in `scripts/live-demo-commissioning-contract.mjs`. It binds both the managed alias and the custom-environment domain to the same exact deployment. These names derive from reported audit evidence; current hosted ownership, protection and alias classification still require authenticated readback. Do not change shared target settings to satisfy a local check; propose isolation if they conflict.
3. Run `npm run validate:qualification-env -- <synthetic-env-file> <qualification-evidence.json>` for the offline qualification configuration. Supplied policy evidence is **attested, unverified**, not runtime proof. All live flags must explicitly equal `false`; missing does not pass. The separate `validate:live-demo-env` command checks a later live-effects configuration and must never be used to make qualification pass.
4. The workflow is **Qualification deployment (activation disabled)**, with `control_sha` and `application_sha` inputs. There is no `confirm` input. `infra/qualification-deployment.json` remains disabled with no trusted ref or approved application SHA. Before any publication/activation, the founder must select an approved `refs/heads/...` control ref and authorize the exact control/application pair. The control SHA must equal `github.workflow_sha`, the control checkout and the approved ref tip; application HEAD must equal its separate approved SHA. Control scripts run from the separate control checkout. No production/default branch assumption is allowed.
5. The inactive pipeline binds project/team/environment, pulled database values, clean application source before/after build, explicit custom build/deploy target, stamped SHA, returned deployment host/ID, both exact aliases and health at all three origins. Isolated official CLI 41.7.0 version/help is verified locally (pull --environment; build/deploy --target; deploy --prebuilt). Hosted settings, authenticated readbacks and activation remain gated. A post-deploy validation failure may leave a deployment/alias change; there is no automatic retry or rollback. Bypass health is not auth acceptance.
6. After separately approved carrier qualification, exercise grant/refusal/withdrawal, capture boundaries, initialization timing, recording/retention and transcript arrival in authenticated review. Calls in the qualification interval permanently prohibit CRM/email effects, including retries after later activation. A later `SUPERVISED_PILOT` requires a distinct authorized call, approved test records/recipient, human-approved frozen content, actual CRM readback, provider message ID and inbox receipt. Keep `RESPONSEOS_LIVE_CALL_DEMO_PUBLIC=false`.

## Required rehearsal evidence

- Invalid and stale Telnyx signatures return `401` and add no ledger or business row.
- Replayed and out-of-order valid events produce one canonical call and one provider event per ID.
- A finalized qualified call produces one contact, one call activity, and one follow-up task in the HubSpot test account; no deal, transcript, or recording URL is exported.
- Ambiguous contact matches produce `review_required` without a HubSpot mutation.
- HubSpot failure preserves the ResponseOS call and exposes a retryable operation in `/admin/demo-operations`.
- Kill switches stop live ingest/CRM execution and hide the number while `/demo` remains available.
- Two consecutive complete internal rehearsals must prove the exact-SHA artifact, tenant isolation, consent boundaries, rollback and absence of duplicate effects. Local unit/integration tests do not establish Mike-demo readiness.

Only after a recorded human go/no-go may `RESPONSEOS_LIVE_CALL_DEMO_PUBLIC` become true and the number be shown to a prospect. Production aliases, real client data, unattended availability, outbound dialing, scheduling, recording, Vapi, Sent.dm, Twilio failover, Calendly, Stripe, and deal creation remain excluded.
