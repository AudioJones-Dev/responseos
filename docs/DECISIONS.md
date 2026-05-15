# Decisions — ResponseOS Architecture Decision Log

This file records the load-bearing decisions that constrain how ResponseOS is built. Each ADR is short by design: context, decision, consequences. If a decision is reversed, mark the entry **Superseded by ADR-XXX** rather than deleting it.

## ADR-0001 — Mock-first development; no live integrations until v0.3

**Status:** Accepted. Carried from v0.1 foundation.

**Context.** ResponseOS depends on Twilio, Retell, Vapi, Stripe, GHL, HubSpot, Resend, n8n, Bland. Wiring those live during v0.1/v0.2 would couple development to vendor accounts, charge real per-call/per-message fees during testing, and gate every contributor on real secrets.

**Decision.** Every provider integration sits behind an adapter in `lib/providers/*`. The mock implementation returns deterministic fixtures. The real implementation lazy-reads env vars and falls back to mock when missing — the app boots and runs without secrets. Live wiring is explicitly gated to v0.3.

**Consequences.** Contributors can run the full app with zero credentials. Tests stay deterministic. v0.1 → v0.2 milestones can complete without vendor sign-up. The cost is a hard rule: nothing in v0.1/v0.2 is allowed to assume real provider responses, and switching to live must be a conscious v0.3 milestone with signature validation + persistence wired in the same PR.

---

## ADR-0002 — Event-ledger-first data model

**Status:** Accepted. Foundation present in v0.1 stubs; formal `events` table targeted for v0.2 closeout.

**Context.** Multi-tenant platform with seven RECOVER stages, multiple inbound channels (Twilio voice/SMS, Retell, Vapi, web forms, outbound campaigns), multiple downstream systems (QuoteIQ, GHL, HubSpot, Google Calendar, Stripe). Without a canonical event log, ROI is non-recomputable when a tenant swaps a CRM, audit is partial, and webhook replay/idempotency is brittle.

**Decision.** Every inbound call, outbound call, SMS, quote, schedule change, approval, payment event, and webhook lands first in a canonical event ledger keyed by a provider-stable dedupe id (Twilio `MessageSid`/`CallSid`, Retell `call_id`, Stripe `event.id`, GHL `event.id`). Business mutations happen downstream of the ledger write. ROI facts and tenant record models are recomputable from the ledger.

**Consequences.** Replay, audit, and CRM-swap migrations all work. Cost: the ledger is the discipline; every new write path must add its dedupe key, and we never let "convenience" mutations bypass the ledger. Tooling cost: ledger growth must be partitioned/archived as tenant count grows.

---

## ADR-0003 — Postgres on Supabase (Standard lane); Prisma for the ORM

**Status:** Accepted.

**Context.** Need a relational store that supports tenant scoping, indexed reads for dashboards, transactional integrity for booking + quote workflows, and a clean HIPAA upgrade path. Schema is well-known up front — the data model in `data-schema.md` is 11 v0.1 models expanding toward ~25 v0.2 tables.

**Decision.** Postgres via Supabase in Standard mode. Prisma is the ORM (`@prisma/client`, `prisma` CLI). Migrations live under `prisma/migrations/` and are applied with `prisma migrate deploy`. The deterministic seed (`prisma/seed.ts`) is keyed to `lib/mock/*` fixtures so dev/test/seeded-CI all show the same data.

**Consequences.** Strong typing across schema + queries via generated Prisma client. Easy local dev (`docker run postgres:16`) and easy CI (service container). Migration discipline: every schema change is a migration; no drift. HIPAA upgrade path swaps Supabase Postgres for RDS — same schema, same Prisma client.

---

## ADR-0004 — Three compliance deployment lanes, selectable per tenant

**Status:** Accepted. Standard is the default; Privacy-hardened and HIPAA-ready are upgrade paths.

**Context.** ResponseOS sells into home services (non-regulated) but the roadmap touches med spas and other regulated-adjacent verticals. A single deployment posture either over-engineers for non-regulated tenants (slow time-to-market) or under-protects regulated tenants (compliance risk).

**Decision.** Three lanes:

| Lane | Stack |
|---|---|
| **Standard** (default) | Vercel + Supabase + Twilio + Retell + Stripe + Cloudflare R2 |
| **Privacy-hardened** | Same as Standard with Retell `Basic Attributes Only`, PII scrubbing, short recording retention, raw-transcript hiding |
| **HIPAA-ready** (v0.3+) | AWS-hosted (CloudFront + Route 53 + ECS/Fargate + RDS + S3 + KMS) + Twilio HIPAA account + Retell BAA + BAA-backed DB |

The compliance posture is a per-tenant tier, not a global default. Provider adapters honor lane-specific behavior (storage mode, retention).

**Consequences.** Two engineering tracks: shared core + lane-specific infra in `infra/terraform/envs/{prod,prod-hipaa}`. **ResponseOS itself is not HIPAA-certified.** Compliance is a per-deployment property and requires re-confirmed BAAs at onboarding time. Marketing/sales must never represent the platform as HIPAA-compliant until a tenant deployment has been independently reviewed.

---

## ADR-0005 — Clerk for authentication (Standard lane)

**Status:** Accepted (provider). Real wiring in progress as part of v0.2 closeout.

**Context.** Need multi-tenant auth with role-aware sessions for `aj_admin`, `operator`, `client_admin`, `client_viewer`. Need SSO support for AJ Digital staff and per-tenant invite flows for client users. Building this in-house is months of work that doesn't differentiate.

**Decision.** Clerk for auth in the Standard lane. `lib/auth/*` wraps Clerk and exposes a single function that derives the `organizationId` and role from the session — every data accessor in `lib/data/*` takes the session-derived `organizationId`, never trusting client-supplied input. HIPAA lane will swap Clerk for Cognito (or equivalent BAA-eligible auth) when the lane ships.

**Consequences.** Faster v0.2 → v1.0 path. Cost: Clerk pricing scales with MAU; budget item per tenant. Lock-in is bounded because the integration is one module (`lib/auth/*`).

---

## ADR-0006 — Cloudflare R2 for object storage (call recordings, quote photos, exports)

**Status:** Accepted (Standard / Privacy-hardened lanes).

**Context.** Need S3-compatible object storage for call recordings, quote photos, and report exports. Egress costs on AWS S3 are punitive for repeated dashboard exports and client-portal media. HIPAA lane requires S3 anyway (BAA, KMS, lifecycle policies).

**Decision.** Cloudflare R2 in Standard and Privacy-hardened lanes (zero egress, S3-compatible API). AWS S3 in HIPAA-ready lane (BAA, KMS, versioning, lifecycle policies). Storage keys carry `organization_id` prefixes for tenant isolation at the bucket-policy level.

**Consequences.** Lower egress cost for client portals at scale. Tenant isolation via key prefix + IAM policy. HIPAA lane requires a separate code path for credentials and bucket selection — handled in `lib/providers/storage/*` (planned).

---

## ADR-0007 — QuoteIQ is a reference + connector, not a system of record

**Status:** Accepted.

**Context.** QuoteIQ is the incumbent quoting tool in the home-services vertical. ResponseOS could either compete with it head-on or treat it as a downstream system. Cloning QuoteIQ end-to-end re-creates solved problems; ignoring it loses tenants who already use it.

**Decision.** QuoteIQ is a downstream system. Public integration surface is outbound webhook events (estimate, schedule) plus Zapier-mediated Google Calendar sync. Architect the data layer so QuoteIQ, GHL, HubSpot, or CSV import can all act as downstream targets. Do **not** assume bidirectional QuoteIQ writes until deeper private API access is confirmed.

**Consequences.** ResponseOS keeps the canonical model + RECOVER orchestration + ROI analytics; QuoteIQ keeps the quoting UX a customer already uses. If QuoteIQ exposes deeper API access later, bidirectional sync can be added without rewriting the canonical model.

---

## ADR-0008 — Primary voice runtime is Twilio + Retell / Vapi / Bland; OpenClaw and Grok Voice are experimental

**Status:** Accepted.

**Context.** Real-time inbound phone answering requires hardened telephony, streaming audio, transcription, barge-in, routing, compliance controls, webhook reliability, and call observability. OpenClaw's strengths are workflow orchestration and assistant patterns, not carrier-grade phone answering. Grok Voice (xAI) is interesting but unverified on telephony integration, retention, BAA eligibility, and concurrency limits.

**Decision.** Primary live voice layer: **Twilio + Retell + Vapi + Bland**. OpenClaw is sandboxed and optional — workflow / agent gateway, internal automation assistant, scheduled follow-up worker — never the primary phone-answering engine. Grok Voice is behind the same provider abstraction and selectable only for non-regulated experiments (website/app voice assistants, internal operator copilot, sales qualification pilots) until quality, reliability, pricing, concurrency, failure modes, telephony path, and compliance posture are verified.

**Consequences.** Reliability + compliance risk is concentrated on a small number of carrier-grade providers. Experimental providers stay isolated from the live phone path until they earn graduation. Provider abstraction layer (`lib/providers/voice/*`) is the chokepoint that enforces this discipline.

---

## ADR-0009 — Webhook signature validation is mandatory before any business mutation

**Status:** Accepted. Staged behind feature flag in v0.2; mandatory before any production traffic in v0.3.

**Context.** Every inbound webhook is a write into the event ledger and can trigger downstream calls, SMS, bookings, or charges. Unsigned or replay webhooks would let an attacker drain budget or corrupt tenant data.

**Decision.** Every provider webhook is signature-validated before the raw body is parsed and before any business mutation. Validation rules:

| Provider | Header | Rule |
|---|---|---|
| Twilio | `X-Twilio-Signature` | HMAC-SHA1 using auth token + full URL + sorted form params; preserve raw body |
| Retell | `x-retell-signature` | Raw-body HMAC; reject events older than 5 minutes (replay protection) |
| Stripe | `Stripe-Signature` | `stripe.webhooks.constructEvent`; IP allowlist Stripe ranges |
| HighLevel | `X-GHL-Signature` (legacy `X-WH-Signature` deprecates 2026-07-01) | HMAC; use HighLevel SDK middleware |
| n8n | shared secret header | Compare against `N8N_WEBHOOK_SECRET` constant-time |

Invalid signature → 401, no body parse, no business mutation, log to security stream.

**Consequences.** Every new webhook adapter ships with its signature rule documented in `SECURITY.md` and a passing integration test. Cost: developer cycles spent on signature verification per provider. Benefit: replay/forgery protection at the ingest edge.

---

## ADR-0010 — Pricing engine, Stripe billing, and outcome-fee ledger ship in v0.5, not v0.2

**Status:** Accepted.

**Context.** Commercial strategy in `pricing-and-onboarding.md` describes paid Readiness Assessment, three implementation tiers, optional outcome fees, founding pilot, usage caps. There's pressure to wire billing early because the commercial offer is already live.

**Decision.** Pricing engine, Stripe billing implementation, outcome-fee ledger, client invoice logic, and in-app pricing-tier selectors ship in **v0.5**, after the v0.2 data foundation and v0.3 live integrations land. The `outcome_fees`, `invoices`, `billing_accounts`, and `usage_meters` tables sketched in `data-schema.md` are planning-only until v0.5. v0.3 adds an outcome-fee invoicing preview as the wiring step that precedes v0.5 implementation.

**Consequences.** Phase 2 retainers are billed manually via Stripe invoices outside the app until v0.5. The v0.3 outcome-fee preview is the migration ramp. Cost: manual ops overhead for early tenants. Benefit: we don't build billing on top of a data model that hasn't proven its event-ledger discipline yet.
