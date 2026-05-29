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

**Status:** **Superseded by ADR-0012** (2026-05-27). The telephony edge (Twilio) and the provider-abstraction discipline survive; the *primary realtime voice provider* decision is reversed. See ADR-0012 for the canonical realtime voice provider order (Grok Voice primary, OpenAI Realtime fallback) and the reconciliation rationale.

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

---

## ADR-0011 — Canonical documentation set + go-forward stack reconciliation

**Status:** Accepted (2026-05-27). Governs ADR-0012 through ADR-0018.

**Context.** A new canonical documentation set was authored under `docs/product/`, `docs/architecture/`, `docs/ops/`, `docs/brand/`, and `docs/research/` (indexed by [`docs/product/RESPONSEOS_BUILD_SOURCE.md`](./product/RESPONSEOS_BUILD_SOURCE.md)). That set specifies a realtime/voice stack that differs from the stack assumed by several earlier ADRs and prose docs — most directly ADR-0008 (primary voice runtime). Per the agent contract in `AGENTS.md`, load-bearing decisions are not relitigated silently; a stack change of this size requires explicit ADRs.

**Decision.** The `RESPONSEOS_*` canonical set is the **go-forward source of truth** for architecture, product, ops, and brand. Where it conflicts with an earlier decision, that earlier decision is marked **Superseded** and a new ADR (0012–0018) records the reversal with its rationale and consequences. The *disciplines* established by the earlier ADRs are explicitly retained and are not weakened by the stack change:

- **ADR-0001 (mock-first; no live integrations until v0.3)** — UNCHANGED. New providers (Grok Voice, OpenAI Realtime, n8n, HubSpot, Redis) sit behind the same `lib/providers/*` adapter discipline and fall back to mock when env vars are absent.
- **ADR-0002 (event-ledger-first)** — UNCHANGED and reinforced. The ledger remains ResponseOS's internal system of record.
- **ADR-0009 (mandatory webhook signature validation)** — UNCHANGED. Applies to every new inbound webhook (HubSpot, n8n, voice-provider callbacks).
- **ADR-0004 (three compliance lanes)** — UNCHANGED. Provider swaps respect lane-specific behavior.

**Consequences.** Two doc sets coexist: the original `docs/*.md` (kept for provenance and still authoritative for anything the new set does not restate) and the `RESPONSEOS_*` set (authoritative for the new stack). Drift is governed: any future stack change updates the relevant `RESPONSEOS_*` doc **and** files an ADR here. The original prose docs (`architecture.md`, `api-spec.md`, etc.) are not rewritten in this pass (see CHANGELOG "minimal glue"); where they conflict with the new set, ADR-0012–0018 win.

---

## ADR-0012 — Realtime voice provider order: Grok Voice primary, OpenAI Realtime fallback (supersedes ADR-0008)

**Status:** Accepted (2026-05-27). **Supersedes ADR-0008.**

**Context.** ADR-0008 made Retell/Vapi/Bland the primary realtime runtime and classified Grok Voice as experimental, pending verification of telephony path, retention, BAA eligibility, and concurrency. The go-forward product direction selects **Grok Voice Agent API as the primary realtime voice provider** and **OpenAI Realtime API as the secondary/fallback**, with Twilio retained as the telephony edge. This is a deliberate reversal driven by realtime capability, tool-use support, and per-minute economics.

**Decision.**

| Role | Provider |
|---|---|
| Telephony edge (carrier, numbers, SIP, Media Streams) | **Twilio** (unchanged) |
| Realtime orchestration | **Node.js voice gateway** (ADR-0013) |
| Primary realtime voice agent | **Grok Voice Agent API (xAI)** |
| Secondary / failover realtime voice agent | **OpenAI Realtime API** |
| Future / optional realtime providers | Retell, Vapi, Bland — demoted to optional, behind the same abstraction |

Both providers sit behind a single provider-abstraction interface in `lib/providers/voice/*` and the voice gateway's provider adapters. **No provider-specific business logic** is permitted above the adapter boundary; failover from Grok → OpenAI must be transparent to the policy engine, tool router, and event ledger.

**Consequences.** ResponseOS takes on the risk ADR-0008 flagged (telephony path, retention, concurrency, compliance posture for Grok/xAI and OpenAI). Those risks are now **managed, not avoided**: (1) regulated/HIPAA-lane tenants MUST NOT use Grok Voice or OpenAI Realtime until each provider's BAA/retention/training-data posture is verified per `RESPONSEOS_SECURITY_AND_COMPLIANCE.md`; (2) a provider-readiness gate (concurrency, barge-in, webhook reliability, transcript handling, escalation/handoff) must pass before live v0.3 traffic; (3) the abstraction remains the chokepoint so a third provider can be added or the order re-swapped without touching business logic. Mock-first (ADR-0001) still holds until v0.3.

---

## ADR-0013 — Dedicated Node.js voice gateway; realtime audio is isolated from the async/workflow layer

**Status:** Accepted (2026-05-27).

**Context.** Realtime media (sub-second audio streaming, barge-in, turn-taking, tool calls during a live call) has fundamentally different latency, scaling, and failure characteristics than the Next.js app (request/response, dashboards) and the async workflow layer (n8n). Mixing them couples a latency-critical path to deploy cadence and failure modes of unrelated surfaces.

**Decision.** A **dedicated Node.js voice gateway** is a first-class service, separate from the Next.js application. It owns: Twilio Media Streams socket handling, the realtime session lifecycle, the provider adapters for Grok/OpenAI realtime, the policy engine and tool router *as invoked during a live call*, and emission of normalized events into the ledger. The Next.js app and n8n never sit in the realtime audio loop. The gateway is stateless except for ephemeral session state held in Redis (ADR-0014); durable truth lands in the event ledger.

**Consequences.** The gateway scales and deploys independently (its own topology, autoscaling on concurrent calls). Clear contract boundary: the gateway speaks to the rest of the system only through the event ledger and typed internal APIs. Cost: an additional deployable service and its own observability/SLOs (see `RESPONSEOS_DEPLOYMENT_PLAN.md`). This is an intentional, bounded service split — not a slide into premature microservices; the rest of the platform stays a modular monolith until scale demands otherwise.

---

## ADR-0014 — Redis for ephemeral realtime session state

**Status:** Accepted (2026-05-27).

**Context.** A live call needs fast, short-lived shared state — partial transcript, current turn, qualification facts gathered so far, active tool-call context, provider/session handles, failover bookkeeping — accessible across gateway workers and during a provider failover, but not durable business data.

**Decision.** **Redis** holds ephemeral realtime session state for the voice gateway (and is the backing store for queues/rate-limit counters where useful). Redis is never the system of record: every fact that must survive the call is written to the canonical event ledger (Postgres). Session keys are namespaced by `organization_id` and `session_id` and carry a TTL so abandoned sessions self-expire.

**Consequences.** Fast cross-worker session continuity and clean failover. Redis loss degrades in-flight calls only (no durable data loss) because the ledger is authoritative. Tenant isolation is enforced via key namespacing; no cross-tenant key access. Adds Redis to the Standard-lane infra footprint and to the secrets/observability surface.

---

## ADR-0015 — HubSpot is the default external CRM system of record; the event ledger remains the internal system of record

**Status:** Accepted (2026-05-27). Extends ADR-0002 and ADR-0007.

**Context.** Earlier docs treated CRMs (GoHighLevel, HubSpot, QuoteIQ) as interchangeable downstream targets. The go-forward direction names **HubSpot as the CRM system of record** for ResponseOS. This must not contradict ADR-0002, which makes the canonical event ledger the source from which all facts are recomputable.

**Decision.** Two distinct "systems of record" with clear scope:

- **Internal system of record = the canonical event ledger** (Postgres). ROI, audit, and replay are computed from the ledger, never from a vendor payload shape. This is unchanged from ADR-0002.
- **External CRM system of record = HubSpot (default).** HubSpot is the canonical *customer-facing* contact/deal/ticket record and the default CRM connector. Contacts, deals, and tickets are mirrored to HubSpot via a tenant-scoped connector; HubSpot ↔ ledger mapping is owned by `lib/providers/hubspot/*`.

CRM remains pluggable per tenant: HubSpot is the default, GoHighLevel and others stay supported as alternative connectors behind the same canonical mapping. No business logic depends on HubSpot-specific payload shapes above the adapter boundary.

**Consequences.** Tenants without HubSpot still work (canonical model + alternative connector or CSV). A tenant can swap CRMs without losing history because facts recompute from the ledger. HubSpot webhooks are signature-validated (ADR-0009) and land in the ledger before mutating any mirrored record. Cost: HubSpot becomes a first-class connector with its own rate-limit, OAuth, and object-mapping concerns documented in `RESPONSEOS_INTEGRATION_MAP.md`.

---

## ADR-0016 — Obsidian is the internal SOP / brand-knowledge layer, distinct from the per-tenant agent grounding layer

**Status:** Accepted (2026-05-27). Partially supersedes the "Obsidian out of scope" note in `architecture.md` § Future Knowledge Layer.

**Context.** `architecture.md` and the v0.4 knowledge-layer docs explicitly excluded an Obsidian integration to prevent ResponseOS from drifting into a generic "second brain" product, and to keep the per-tenant RAG/grounding layer gated to v0.4 behind isolation/audit/retention controls. The go-forward direction names **Obsidian as the SOP + memory + brand-knowledge layer**. These can be reconciled by scoping Obsidian precisely.

**Decision.** Obsidian is the **internal, operator-side SOP and brand-knowledge layer** — a Git-backed Markdown vault owned by AJ Digital that holds operating procedures, brand voice, playbooks, prompt/policy source material, and runbook content. It is an authoring/source-of-truth surface for humans, version-controlled in GitHub, and may *feed* prompt and policy profiles. It is explicitly **NOT**:

- the per-tenant client knowledge ingestion / agent grounding layer (that remains a v0.4 target, gated per `ROADMAP.md` and `SECURITY.md`);
- a vector index, embeddings store, RAG runtime, or client document-upload pipeline;
- a store of tenant PII or transcripts.

**Consequences.** The internal knowledge/SOP layer can ship without waiting for v0.4 because it carries no tenant PII and no automated ingestion of client data. The per-tenant grounding layer's gates (tenant isolation, source ownership, audit, retention, PII minimization) are untouched. If Obsidian content ever feeds live agent prompts, it does so through the reviewed prompt/policy profile pipeline, not as free-form runtime retrieval.

---

## ADR-0017 — n8n is the async orchestration layer and is kept out of the realtime audio loop

**Status:** Accepted (2026-05-27). Formalizes the hybrid posture from `product-spec.md` / `research-report.md`.

**Context.** n8n is used for tenant-specific and cross-system workflow automation (follow-up cadences, CRM sync fan-out, scheduled jobs, notifications). There is a temptation to let workflow tooling reach into latency-critical paths.

**Decision.** **n8n is strictly an async/eventual-consistency layer.** It is triggered *downstream* of the event ledger (and via signed webhooks, ADR-0009) and never participates in the realtime audio loop owned by the voice gateway (ADR-0013). Core RECOVER orchestration lives in code; n8n handles client-specific glue and long-running async sequences. n8n workflow definitions are versioned in Git (Git is upstream of n8n, not the reverse). Every n8n run is logged to `workflow_runs` with a `workflowRunId` for idempotency.

**Consequences.** Realtime reliability is insulated from workflow-engine failures and deploys. Async work is replayable and auditable via the ledger + `workflow_runs`. Cost: a clear hand-off contract between the gateway/core and n8n must be maintained; "convenience" calls from a live call into n8n are prohibited.

---

## ADR-0018 — Observability stack: PostHog (product analytics) + Sentry + Better Stack, on an OpenTelemetry spine

**Status:** Accepted (2026-05-27). Extends the observability posture in `DEPLOYMENT.md`.

**Context.** The platform needs product analytics (funnel, activation, feature usage), error/release health, and uptime/log monitoring across the Next.js app, the voice gateway, and async workers — with per-tenant scoping.

**Decision.** **PostHog** for product analytics, **Sentry** for error tracking and release health, **Better Stack** for uptime monitoring, log management, and incident/on-call alerting — all emitting through an **OpenTelemetry** instrumentation spine where practical. Telemetry is tagged with `organization_id` (never raw PII) so analytics and dashboards are tenant-scoped. Voice-gateway realtime metrics (concurrency, barge-in latency, provider-failover rate) are first-class signals.

**Consequences.** Clear separation of product analytics from operational monitoring. Per-tenant observability without leaking PII into third-party analytics. Cost: three observability vendors to manage plus the OTel pipeline; secrets and data-processing terms for each must be tracked in `RESPONSEOS_SECURITY_AND_COMPLIANCE.md`. Mock-first applies: in dev/test these emit to no-op/local sinks when keys are absent.

---

## ADR-0019 — v0.3 demo deploy sequencing: v0.2 closeout precedes any v0.3 demo deploy

**Status:** Accepted (2026-05-29). Tracks roadmap checkpoint issue #27.

**Context.** PR #14 (`feat/v0.3-demo-deploy`) proposes a password-gated Vercel + Neon demo deploy of the current `master` surface using an HTTP basic-auth shim, a one-shot `prisma migrate deploy` + `prisma db seed`, and a uniform `aj_admin` session behind the gate. Its diff is tight (proxy.ts, runbook, `.env.example`) and merges cleanly. Three problems:

1. **Label conflict.** `ROADMAP.md` (L14, L23) places `Organization`→`Account` and `Booking`→`Appointment` renames in **v0.2 closeout**; PR #14's runbook §7 lists them as "deferred to v0.3." ROADMAP is the source of truth; PR #14 is misaligned.
2. **Architectural fit.** Real auth-provider wiring is a v0.2 closeout item (ADR-0005). Shipping a basic-auth-shim demo on the eve of real auth wiring entrenches a temporary pattern as the first public-facing surface of ResponseOS — the wrong reference point for future docs, reviewers, and agents.
3. **Roadmap integrity.** v0.2 closeout is currently "🟡 In flight" (ROADMAP L14). A demo deploy now either ships a known-incomplete surface or implicitly redefines what v0.2 closeout includes.

**Decision.** **v0.2 closeout precedes any v0.3 demo deploy.**

1. PR #14 stays draft. No rebase, no draft→ready transition, no continued implementation on `feat/v0.3-demo-deploy` until v0.2 closeout lands on `master`.
2. The v0.2 closeout execution sequence (separate, scoped PRs, in order, each merging green to `master`):
    1. `Organization` → `Account` rename.
    2. `Booking` → `Appointment` rename.
    3. Remaining v0.2-spec models: `provider_connections`, `conversations`, `sms_messages`, `call_segments`, `call_transcripts`, `workflow_runs`, `qa_logs`, expanded `audit_logs`.
    4. **Clerk auth integration / alignment per ADR-0005** (see Auth-direction note below).
    5. UI rebuild against `DESIGN.md` tokens, using the finalized naming, auth surface, and data contracts.
3. Once steps 2.1–2.5 land on `master`, the v0.3 demo deploy is unlocked. PR #14's deployment *pattern* (Vercel + Neon, one-shot provisioning, edge gate, `/api/health` allowlist, rollback shape) is preserved as reference material; the **basic-auth shim is replaced with real Clerk-authenticated login** before that deploy goes live.
4. Issue #26 (seed idempotency) remains P2/non-blocking unless the eventual v0.3 demo deploy adopts a re-seed-without-truncate flow. If it does, #26 is promoted before the demo goes live.

**Auth direction — resolved.** Earlier "Auth.js" language in the operator directive and PR #14's runbook is **stale / inaccurate relative to the repo's current ADR record** and is not authoritative. **Clerk remains the standing auth direction** because ADR-0005 names Clerk for Standard-lane auth and has not been superseded. Implications for closeout step 2.4:

- Closeout step 2.4 is Clerk integration / alignment per ADR-0005.
- No Auth.js implementation work is authorized.
- Any future Auth.js (or other auth-provider) pivot requires a dedicated superseding ADR that includes (a) the rationale for replacing Clerk, (b) tenant-RBAC implications across `aj_admin` / `operator` / `client_admin` / `client_viewer`, and (c) a concrete Clerk-removal / migration plan.
- Future closeout prompts, runbooks, and PR descriptions must not quietly drift the repo toward Auth.js by implication.

**Consequences.** v0.2 closeout becomes a hard prerequisite for any production-facing deploy. Time-to-demo is longer, but the eventual demo presents real Clerk-authenticated login, finalized naming, and the full v0.2-spec data surface — a product milestone rather than a temporary scaffold. PR #14 absorbs an indefinite rebase debt and may be closed in favor of a fresh PR once closeout completes; either is acceptable. Mock-first (ADR-0001), tenant-isolation (ADR-0009, AGENTS.md), event-ledger-first (ADR-0002), and the Clerk auth direction (ADR-0005) are unchanged.
