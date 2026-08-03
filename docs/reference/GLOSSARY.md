# ResponseOS Glossary

**Status:** Draft reference baseline. Pending Audio approval.
**Scope:** Shared terms used across ResponseOS product, architecture, governance, and delivery docs.

| Term | Meaning |
|---|---|
| Account | Tenant root in the implemented schema. Replaces historical `Organization` naming. |
| ADR | Architecture Decision Record. Current accepted decisions live in `docs/DECISIONS.md` unless a future approved ADR folder is adopted. |
| AI Revenue Recovery Platform | ResponseOS positioning: recover missed demand, qualify/route leads, automate follow-up, book opportunities, and prove ROI. |
| Appointment | Scheduled job visit or booking. Replaces historical `Booking` naming. |
| CAL | Communications Abstraction Layer. Planned abstraction over carrier, SMS, AI voice, messaging, webhook, and usage-metering providers. |
| Clerk | Standard-lane authentication provider. |
| Client Portal | Tenant-facing surface under `app/(client)/`. |
| Definition of Done | Governance doc defining when work can be considered complete for review/merge. |
| Definition of Ready | Governance doc defining when work can start. |
| Definition of Stable | Governance doc defining when dependent work can rely on a surface. |
| Event ledger | Canonical event-first discipline for ingest, replay, audit, and ROI recomputation. |
| Golden-call pack | Curated conversation regression set for voice/provider/prompt behavior. |
| HIPAA-ready lane | Future per-tenant deployment pattern requiring independent review and verified BAA chain. ResponseOS is not HIPAA-certified by default. |
| Mock-first | Provider integrations run safely without secrets and fall back to deterministic mock behavior. |
| Neon | Accepted hosted Standard-lane Postgres target per ADR-0026. Local dev/CI use plain Postgres 16. |
| Operator Console | AJ Digital internal surface under `app/(admin)/`. |
| Provider adapter | Internal interface hiding vendor-specific implementation details. |
| RECOVER | ResponseOS operating framework: Respond, Evaluate, Capture, Offer, Verify, Escalate, Report. |
| ResponseOS | AJ Digital AI Revenue Recovery Platform. |
| Tenant isolation | Rule that every tenant-scoped read/write filters by session-derived `accountId`, never client input. |
| V0.3 gate | Explicit approval boundary before live provider integrations or production deploys. |
| Webhook signature validation | Required verification before body parse or business mutation. |
| Worktree | Separate checkout attached to a branch, used to isolate work when the primary checkout is dirty or another branch is active. |

## Historical Terms

| Historical term | Current term / status |
|---|---|
| Organization | Account |
| Booking | Appointment |
| Supabase Standard-lane Postgres | Superseded by Neon per ADR-0026 |
| Auth.js | Stale for Standard-lane auth; Clerk is current |
| Twilio default carrier | Superseded for v0.3 planning by Telnyx primary / Twilio failover |

