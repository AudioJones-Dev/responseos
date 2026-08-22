# ResponseOS GTM and prospect-demo deployment runbook

**Status:** Repository contract only. No platform resource, credential, provider, deployment, phone routing, or prospect release is authorized by this document.

## Isolation contract

| Lane | Vercel project | GitHub Environment | Providers | Public live number |
| --- | --- | --- | --- | --- |
| Mock staging | `responseos-staging-mock` | `staging` | No provider credentials; all adapters mock | Never |
| Supervised live demo | `responseos-live-demo` | `live-demo-staging` | Telnyx signed post-call ingest and HubSpot developer test account only | Hidden until final go/no-go |

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

1. Create the isolated `responseos-live-demo` resources and HubSpot developer test account/private app.
2. Configure the Telnyx assistant and dedicated `+17867560897` number outside ResponseOS. Recording stays disabled. The assistant must disclose automation/transcription, refuse unsupported promises, and offer a human callback.
3. Store only environment-scoped credentials. Set both explicit live enable flags; token/key presence alone is insufficient.
4. Run `Deploy Live Demo Staging` with `confirm=live-demo-staging` and the reviewed SHA.
5. Keep `RESPONSEOS_LIVE_CALL_DEMO_PUBLIC=false` through private calls and failure drills.

## Required rehearsal evidence

- Invalid and stale Telnyx signatures return `401` and add no ledger or business row.
- Replayed and out-of-order valid events produce one canonical call and one provider event per ID.
- A finalized qualified call produces one contact, one call activity, and one follow-up task in the HubSpot test account; no deal, transcript, or recording URL is exported.
- Ambiguous contact matches produce `review_required` without a HubSpot mutation.
- HubSpot failure preserves the ResponseOS call and exposes a retryable operation in `/admin/demo-operations`.
- Kill switches stop live ingest/CRM execution and hide the number while `/demo` remains available.
- One outside-number rehearsal proves the exact-SHA artifact, tenant isolation, rollback, and absence of duplicate effects.

Only after a recorded human go/no-go may `RESPONSEOS_LIVE_CALL_DEMO_PUBLIC` become true and the number be shown to a prospect. Production aliases, real client data, unattended availability, outbound dialing, scheduling, recording, Vapi, Sent.dm, Twilio failover, Calendly, Stripe, and deal creation remain excluded.
