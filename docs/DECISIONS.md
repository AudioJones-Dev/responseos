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

**Status:** **Superseded by ADR-0026** (2026-05-30) — Neon replaces Supabase as the Postgres host (the code is host-agnostic Postgres, so Prisma / migrations / seed / schema are unchanged). Originally Accepted.

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

**Decision.** Clerk for auth in the Standard lane. `lib/auth/*` wraps Clerk and exposes a single function that derives the `accountId` and role from the session — every data accessor in `lib/data/*` takes the session-derived `accountId`, never trusting client-supplied input. HIPAA lane will swap Clerk for Cognito (or equivalent BAA-eligible auth) when the lane ships.

**Consequences.** Faster v0.2 → v1.0 path. Cost: Clerk pricing scales with MAU; budget item per tenant. Lock-in is bounded because the integration is one module (`lib/auth/*`).

---

## ADR-0006 — Cloudflare R2 for object storage (call recordings, quote photos, exports)

**Status:** Accepted (Standard / Privacy-hardened lanes).

**Context.** Need S3-compatible object storage for call recordings, quote photos, and report exports. Egress costs on AWS S3 are punitive for repeated dashboard exports and client-portal media. HIPAA lane requires S3 anyway (BAA, KMS, lifecycle policies).

**Decision.** Cloudflare R2 in Standard and Privacy-hardened lanes (zero egress, S3-compatible API). AWS S3 in HIPAA-ready lane (BAA, KMS, versioning, lifecycle policies). Storage keys carry `account_id` prefixes for tenant isolation at the bucket-policy level.

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

**Status:** **Superseded by ADR-0024** (2026-05-30) for the v1 default provider order. Originally Accepted (2026-05-27); superseded ADR-0008. The provider-abstraction + Twilio-edge principles below remain in force under ADR-0024.

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

**Decision.** **Redis** holds ephemeral realtime session state for the voice gateway (and is the backing store for queues/rate-limit counters where useful). Redis is never the system of record: every fact that must survive the call is written to the canonical event ledger (Postgres). Session keys are namespaced by `account_id` and `session_id` and carry a TTL so abandoned sessions self-expire.

**Consequences.** Fast cross-worker session continuity and clean failover. Redis loss degrades in-flight calls only (no durable data loss) because the ledger is authoritative. Tenant isolation is enforced via key namespacing; no cross-tenant key access. Adds Redis to the Standard-lane infra footprint and to the secrets/observability surface.

---

## ADR-0015 — HubSpot is the default external CRM system of record; the event ledger remains the internal system of record

**Status:** Accepted (2026-05-27). Extends ADR-0002 and ADR-0007. **Amended by ADR-0027** (2026-05-30): HubSpot is demoted from *default* external CRM SoR to a *recommended, client-owned* connector with no mandated default; the internal-ledger-SoR decision below is unchanged.

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

**Decision.** **PostHog** for product analytics, **Sentry** for error tracking and release health, **Better Stack** for uptime monitoring, log management, and incident/on-call alerting — all emitting through an **OpenTelemetry** instrumentation spine where practical. Telemetry is tagged with `account_id` (never raw PII) so analytics and dashboards are tenant-scoped. Voice-gateway realtime metrics (concurrency, barge-in latency, provider-failover rate) are first-class signals.

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

---

## ADR-0020 — Provider credential encryption: app-layer, env-managed key, opaque ciphertext (v0.2 substrate)

**Status:** Accepted (2026-05-29). Resolves Q1 of [`docs/product/RESPONSEOS_V0_2_REMAINING_MODELS_IMPLEMENTATION_PLAN.md`](../product/RESPONSEOS_V0_2_REMAINING_MODELS_IMPLEMENTATION_PLAN.md). Precondition for v0.2 closeout step 2.3 PR 31A (`provider_connections`).

**Context.** The v0.2 step 2.3 planning artifact identifies `provider_connections` as a new model holding per-tenant credentials for Twilio, Grok, OpenAI, HubSpot, Google Calendar, Cal.com, Stripe, etc. `RESPONSEOS_DATA_MODEL.md` §4.4 states credentials are "encrypted at rest, decrypted at request time" but does not pick a mechanism. The planning artifact flagged this as Q1 and said an ADR was needed before 31A. The choice space is bounded by three constraints already in force:

- **ADR-0001 (mock-first)** — substrate ships without live provider integration. Credentials are not actively used until v0.3, but a real schema and a real ciphertext column must exist now so 31A can land.
- **ADR-0004 (three compliance lanes)** — HIPAA-ready lane requires a per-tenant KMS posture that v0.2 does not establish. Standard lane is the only lane in use today.
- **ADR-0019 (closeout-first)** — no production-facing deploy until v0.2 closeout completes. Whatever encryption posture v0.2 picks must have a clean upgrade path to KMS/Vault in v0.3, without a schema migration.

**Decision.**

1. **Plaintext storage of provider credentials is prohibited.** No JSON column ever holds an unencrypted access token, secret, OAuth refresh token, API key, signing key, or any other credential material.
2. **v0.2 uses application-layer encryption** with an env-managed key contract. The encryption / decryption happens in a single module (planned: `lib/providers/encryption/*`) — never inline in `lib/data/*` accessors.
3. **Algorithm:** AES-256-GCM (authenticated encryption with associated data) with a 12-byte random nonce per ciphertext. AAD includes `account_id` + `provider` to bind a ciphertext to the tenant + provider context (defeats cross-row swap attacks).
4. **Storage shape:** the encrypted credential payload is stored as opaque ciphertext — Prisma type `Bytes` (Postgres `bytea`). **Not** as queryable JSON. Indexing on credential contents is explicitly out of scope.
5. **Envelope framing:** a fixed-size header precedes the ciphertext bytes — `[version: u8 | algorithm: u8 | nonce: 12 bytes]`. This keeps the schema simple (one `Bytes` column per encrypted artifact) while supporting key rotation (the `version` byte indexes the active key).
6. **Key contract:** the encryption key is read from a single env var (placeholder name for v0.2: `RESPONSEOS_PROVIDER_KEY`, expected base64-encoded 32 bytes). When the env var is absent, the encryption module **falls back to mock** per ADR-0001: a redacted-sentinel string (`"<MOCK_REDACTED>"`) is stored, no real key derivation is performed, and decryption returns a deterministic mock-credential map shaped per provider. App boots and runs with zero credentials.
7. **Scope of "credentials" covered:** the same posture applies to any encrypted column 31A introduces — at minimum `credentials_encrypted` and (where the provider is OAuth-based) `oauth_refresh_token_encrypted`. Both are `Bytes` with the same envelope framing.
8. **What 31A may implement against this ADR:**
    - A `credentials_encrypted Bytes` column (and `oauth_refresh_token_encrypted Bytes?` where applicable) on `provider_connections`.
    - A `lib/providers/encryption/*` module exposing `encryptCredentials(plaintext, { accountId, provider }) → Bytes` and `decryptCredentials(ciphertext, { accountId, provider }) → plaintext` with the mock-fallback behavior above.
    - Unit tests that round-trip a known plaintext through encrypt → store → fetch → decrypt without exposing plaintext in any log line, error message, or test snapshot.
    - Integration tests asserting that the `credentials_encrypted` column never contains the literal plaintext, and that mock-mode returns the redacted sentinel.

**Explicitly out of scope for v0.2.**

- **KMS / Vault / live secret-manager integration.** No AWS KMS, no GCP KMS, no HashiCorp Vault, no Supabase Vault, no Doppler. Those land per the v0.3 deploy-lane decision (likely a future ADR).
- **Per-tenant key isolation.** The env-managed key is global in v0.2. Per-tenant key derivation requires KMS-backed key wrapping and is HIPAA-ready-lane gated per ADR-0004.
- **Key rotation procedure.** Acknowledged as future work — the envelope's `version` byte enables it, but the rotation runbook itself is not specified here.
- **Live provider wiring.** No Twilio / HubSpot / Grok / OpenAI / Stripe / Cal.com / Google API calls. Credentials may be encrypted and stored, but no consumer reads them in v0.2.
- **Break-glass decryption audit.** Once 31D ships `audit_logs.category = "break_glass"`, any `aj_admin`-initiated decryption with elevated context is to be logged via that path. Until 31D lands, no privileged decryption surface is exposed.

**Consequences.**

- **Pros.** Substrate ships now without coupling v0.2 to KMS/Vault decisions. v0.3 has a clean upgrade path — the `Bytes` column shape is unchanged when the key source moves from env to KMS; only the key-fetching contract changes. Mock-first invariant (ADR-0001) is preserved: the app boots with no key. Tenant-isolation (ADR-0009, AGENTS.md) is unchanged — `account_id` scoping at the data layer is independent of the global encryption key.
- **Cons.** A single env-managed key is a weaker security posture than per-tenant KMS-backed keys. **This ADR is explicit that the v0.2 posture is not acceptable for live tenant traffic.** Live traffic gates on v0.3, which requires a follow-up ADR establishing the production key posture. Compromise of the env key in v0.2 (a development/preview-only environment per ADR-0019) exposes all stored credentials — which in v0.2 are mock or placeholder values anyway.
- **Compliance-lane posture.** Standard lane: acceptable for v0.2 substrate. Privacy-hardened lane: same as Standard for v0.2 substrate; live traffic requires v0.3 posture review. HIPAA-ready lane (ADR-0004): **blocked** from using `provider_connections` until KMS-backed key derivation lands.
- **Operational invariant.** A future ADR superseding this one (Standard-lane KMS posture for v0.3) is expected. This ADR does not block that supersession; it specifies the substrate the supersession will upgrade.

**Future work — acknowledged.**

- KMS / Vault integration ADR (likely ADR-0021+), aligned with v0.3 deploy lane.
- Key rotation runbook (envelope `version` byte already supports it; procedure spec is pending).
- Per-tenant key derivation for HIPAA-ready lane per ADR-0004.
- Break-glass decryption audit, integrating with `audit_logs.category = "break_glass"` once 31D ships.
- Compliance-lane review at the v0.3 provider-readiness gate per ADR-0012 §"Provider readiness gate".

---

## ADR-0021 — Brand 2.0 visual direction: Signal Yellow `#E8FF5A` primary, `#FF4500` secondary, Syne wordmark

**Status:** Accepted (2026-05-30). Amends the `DESIGN.md` accent/typography posture; runtime reconciliation scheduled for Phase 1. Resolves §24 row 5 of [`product/responseos-gtm-product-roadmap.md`](./product/responseos-gtm-product-roadmap.md).

**Context.** `DESIGN.md` (v0.2 design freeze) set a dark-first system with `#FF4500` as the single primary accent and Sora (display) / Inter (body) / JetBrains Mono. PR #43 implemented that system in `app/globals.css`. The Audio Jones Brand 2.0 direction (Canva kit `kAHJkU6n4S8`, captured in the GTM roadmap §13–§14) elevates **Signal Yellow `#E8FF5A`** as the primary brand signal and adopts **Syne** for the `ResponseOS` wordmark.

**Decision.**

1. **Primary accent / brand signal = Signal Yellow `#E8FF5A`** — reserved for primary CTAs, key metrics, and intelligence highlights ("signal emerging from black").
2. **`#FF4500` is retained as a *secondary* `action-orange`** — urgency, revenue-leak, and diagnostic-warning moments only. Demoted from primary, **not removed**.
3. **Brand/display typography = Syne** (Bold / ExtraBold) for the `ResponseOS` wordmark and `RO` compact mark. Product-UI body (Inter) and mono (JetBrains Mono) are unaffected by this ADR; only the display/brand face moves toward Syne.
4. **Interim tolerance.** The v0.2 UI (PR #43) ships the `DESIGN.md` tokens (`#FF4500` primary, Sora/Inter) and **may merge as interim scaffolding** — it is pre-Brand-2.0, not wrong.
5. **Reconciliation is a Phase 1 task** under explicit authorization: update `DESIGN.md` + `app/globals.css` (`--color-accent` → `#E8FF5A`, add an action/orange token for `#FF4500`, display font → Syne). **This ADR changes no runtime token or font** — it sets the direction those future edits follow.

**Consequences.** #43 can be reviewed and merged on its own merits without blocking on a re-skin; the brand migration becomes a contained token+font swap in Phase 1. Until that lands, the live UI and the brand canon are knowingly out of sync — this ADR is the record that the divergence is intentional and scheduled. Exact hex/palette values remain **TODO-verify** against Canva kit `kAHJkU6n4S8` (GTM §13/§25).

---

## ADR-0022 — Positioning: Business Memory / Response Intelligence is the near-term GTM wedge

**Status:** Accepted (2026-05-30). Broadens the `PRD.md` category framing; does **not** retire Revenue Recovery. Resolves §24 row 1 of the GTM roadmap.

**Context.** `PRD.md` / `product-spec.md` frame ResponseOS as "the AI Revenue Recovery Platform." The Brand 2.0 / GTM direction leads with **business memory** — capturing calls, notes, docs, decisions, SOPs, and workflows into structured, AI-ready operational memory (the "Managed Business Memory System" offer).

**Decision.**

1. The **near-term GTM wedge** is **Business Memory / Revenue Memory / Response Intelligence** — a managed business-memory + response system for founder-led service businesses.
2. **Revenue Recovery is retained as the *outcome*, not retired.** The framings compose: *business memory is the mechanism; recovered revenue is the proof.* The mechanics (missed-call capture → qualify → follow-up → book → attribute recovered revenue) are unchanged.
3. Public/marketing copy (`audiojones.com`) leads with the customer problem (memory leakage, lost context, missed follow-up); engineering/product canon may continue to use "Revenue Recovery Platform" internally where accurate.

**Consequences.** Marketing/landing copy (Phases 2/5) leads with the memory/intelligence narrative; engineering docs and product mechanics need no rewrite. `PRD.md` should gain a positioning note pointing to this ADR and the GTM spec when next revised. No product behavior changes.

---

## ADR-0023 — Domain mapping: `audiojones.com` = public/GTM, `ajdigital.app` = app infrastructure

**Status:** Accepted (2026-05-30). New decision. Resolves the domain item in §24 / GTM §20.

**Context.** The operator owns `audiojones.com` (personal brand / authority) and `ajdigital.app` (product/app infra). The GTM spec §20 proposes a split; this ADR fixes it so route/deploy planning (incl. the #44 demo-deploy plan) has a stable assumption.

**Decision.**

1. **`audiojones.com`** = public personal brand, authority, content, and **GTM/marketing pages**. First GTM routes: `audiojones.com/responseos` and `audiojones.com/business-memory-system`.
2. **`ajdigital.app`** = **product/app infrastructure**: authenticated app, portals, dashboards, client systems. Future subdomains: `app.ajdigital.app`, `clients.ajdigital.app`, `vault.ajdigital.app` (and `status.` / `docs.` as needed).
3. `ajdigital.app` is **not** the primary public marketing site unless brand strategy shifts from personal-brand-led to product-company-led.
4. **No DNS, domain, or deployment configuration is changed by this ADR** — it records the mapping future deploy work (v0.3-gated per ADR-0019) will implement.

**Consequences.** The #44 demo-deploy plan and any Phase 5/6 routing target these domains. No code/DNS/deploy change now; production deploy remains v0.3-gated (ADR-0019).

---

## ADR-0024 — v1 AI/voice provider stance: OpenAI default, ElevenLabs premium, Vapi/Retell optional, Grok optional (supersedes ADR-0012)

**Status:** Accepted (2026-05-30); **telephony default superseded by ADR-0031** (Telnyx primary, Twilio failover) and **orchestration amended by ADR-0032** (Vapi primary; OpenAI-as-brain left open). **Supersedes ADR-0012** (realtime provider *order*). The OpenAI-default *model* layer and the provider-abstraction principle stand pending the open LLM-brain decision (ADR-0032). Resolves §24 row 4 of the GTM roadmap.

**Context.** ADR-0012 set Grok Voice as the primary realtime voice provider with OpenAI Realtime as fallback. The Brand 2.0 / GTM direction (GTM §10) selects a simpler **OpenAI-default** v1 posture for reasoning, basic voice, and transcription, with the other providers in clearly-scoped optional roles. This is a deliberate change of the *default*, not the architecture.

**Decision.**

| Role | v1 stance |
|---|---|
| Default reasoning + basic voice + transcription | **OpenAI** (incl. Whisper) |
| Premium / custom / branded voice (with consent) | **ElevenLabs** — Growth/Enterprise add-on |
| Voice-agent orchestration | **Vapi / Retell** — *optional*, adopted only after validation reduces build complexity |
| Telephony edge | **Twilio or Telnyx** — Twilio remains default; Telnyx is now a sanctioned alternative |
| Optional alternate reasoning / search | **Grok/xAI, Anthropic, Gemini, Perplexity, OpenRouter** — *not* the default voice-design layer |

The **provider-abstraction principle is retained**: all providers sit behind `lib/providers/voice/*` (and the voice-gateway adapters if/when built); no provider-specific business logic above the adapter boundary. This ADR changes the default order, not the boundary.

**Consequences.** Simpler v1 path (one default brain/voice/transcription vendor). The Node.js voice-gateway architecture (ADR-0013) and Redis ephemeral session state (ADR-0014) are **not** retired — they remain the realtime design if/when realtime voice is built; only the default provider changes. Mock-first (ADR-0001) and the v0.3 live-wiring + provider-readiness gate still hold; regulated/HIPAA-lane tenants must clear BAA / retention / training-data review before any live provider use. ADR-0012 is marked Superseded by this ADR.

---

## ADR-0025 — Logo/asset system: two core marks; favicons/app icons derived from the `RO` compact mark

**Status:** Accepted (2026-05-30). New decision. Ratifies GTM §14–§15. **Creates no asset files.**

**Context.** The GTM spec §14–§15 defines a `ResponseOS` Syne wordmark and an `RO` compact mark plus a future asset-export pipeline. Operator-provided Brand 2.0 references (white "Response" + Signal-Yellow "OS" wordmark; `RO` mark with a Signal-Yellow `O`) confirm the direction.

**Decision.**

1. **Exactly two core brand assets:** the **`ResponseOS` wordmark** (Syne; white `Response` + Signal-Yellow `OS` on dark) and the **`RO` compact mark** (Syne; Signal-Yellow `O`).
2. **Favicons and app icons are *derived exports* of the `RO` compact mark** — not independent designs (`favicon.ico`, `favicon.svg`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`).
3. The wordmark is the **primary** mark (navbar/header); `RO` is the **utility/compact** mark (favicon, app icon, compact sidebar, avatar, loading).
4. **No asset files are created by this ADR.** Producing the SVG/PNG/ICO exports and wiring them into `app/layout.tsx` metadata and `/public` is a future, explicitly-authorized task (GTM §15/§17), not part of this docs-only decision.

**Consequences.** Asset production has a fixed, minimal target (two source marks → derived icons), preventing logo sprawl. Later favicon/app-icon work is a mechanical export from one source. No runtime/asset change now.

---

## ADR-0026 — Neon Postgres is the default structured-memory database (supersedes ADR-0003)

**Status:** Accepted (2026-05-30). **Supersedes ADR-0003** (Supabase hosting choice). Prisma, migrations, seed, and schema are unchanged. Resolves §24 row 3 of [`product/responseos-gtm-product-roadmap.md`](./product/responseos-gtm-product-roadmap.md).

**Context.** ADR-0003 chose "Postgres on Supabase (Standard lane), Prisma ORM." Since then auth moved to Clerk (ADR-0005) and object storage to Cloudflare R2 (ADR-0006), leaving Supabase's only role as the Postgres engine. The codebase reflects this: the Prisma datasource is generic `provider = "postgresql"` reading `DATABASE_URL` / `DIRECT_URL`, with **zero Supabase-specific code, SDK, or config anywhere in the repo**. The GTM direction (§4) selects **Neon** for a clean modular fit — Clerk owns auth, R2 owns storage, Neon owns structured memory.

**Decision.**

1. **Default structured-memory database = Neon Postgres** (serverless Postgres, Standard lane).
2. **Zero code change.** Prisma stays the ORM; `provider = "postgresql"`; migrations (`prisma migrate deploy`) and the deterministic seed (`prisma/seed.ts`) are unchanged. The switch is a **connection-string / hosting** decision (`DATABASE_URL` / `DIRECT_URL` point at Neon), not a migration.
3. Local dev and CI continue on plain `postgres:16` (Docker / service container) — no Neon dependency for tests.
4. **HIPAA-ready lane** (ADR-0004) swaps the managed host (Neon → a BAA-backed Postgres such as RDS or Neon's HIPAA offering) — same schema, same Prisma client. This replaces ADR-0003's "Supabase → RDS" note.

**Consequences.** Modular backend (Clerk + Neon + R2), each concern independently swappable, matching the GTM architecture. Because the code is host-agnostic Postgres, the decision is low-risk and reversible. Supabase leaves the stack. A future consolidated-backend direction (auth+storage+db+realtime in one) would be a separate decision superseding this ADR and ADR-0005/0006. Mock-first (ADR-0001) holds — the app boots with no `DATABASE_URL`.

---

## ADR-0027 — Operational system of record is ResponseOS memory; external CRM is client-owned and pluggable, with no mandated default (amends ADR-0015)

**Status:** Accepted (2026-05-30). **Amends ADR-0015** — demotes HubSpot from "default external CRM system of record" to a recommended client-owned connector. The internal-ledger-SoR decision (ADR-0002) is unchanged. **Re-amended by ADR-0033** (2026-05-31): HubSpot restored as the *default* external commercial CRM SoR, client-overridable; the internal-ledger SoR remains unchanged. Resolves §24 row 7.

**Context.** ADR-0015 named HubSpot the *default* external CRM system of record while keeping the canonical event ledger as the internal SoR. The Business-Memory positioning (ADR-0022) makes ResponseOS's own operational memory (event ledger + structured business memory) the product's core asset and treats the customer's CRM as one client-owned connected system. GTM §5/§7 frames CRM as client-owned with no named default.

**Decision.**

1. **Operational system of record = ResponseOS operational memory** — the canonical event ledger (Postgres, ADR-0002) plus the structured business-memory records derived from it. ROI, audit, attribution, and replay compute from this, never from a vendor payload. **Unchanged from ADR-0002.**
2. **External CRM is client-owned and pluggable, with no mandated default.** HubSpot is **demoted from "default SoR" to a recommended first-class connector**; GoHighLevel, Airtable, Notion, or none are equally valid. The tenant owns and controls its CRM; ResponseOS syncs to/from it via the canonical mapping (`lib/providers/*`), and full history survives a CRM swap because facts recompute from the ledger.
3. No business logic depends on any CRM-specific payload above the adapter boundary (unchanged).

**Consequences.** Aligns the data-ownership story with the Business-Memory offer: ResponseOS owns operational memory; the client owns their CRM. HubSpot stays fully supported and recommended but is no longer privileged as "the" SoR. No code change — `lib/providers/hubspot/*` and the connector abstraction are unchanged; this is a positioning/ownership clarification. Signature validation (ADR-0009) and ledger-first ingestion are unchanged.

---

## ADR-0028 — Go-forward pricing model: capacity + voice + AI-usage memory tiers (billing implementation stays v0.5)

**Status:** Accepted (2026-05-30) for the pricing **model/structure**. Price points and billing implementation remain **open / v0.5-gated** (ADR-0010). Resolves the *model* half of §24 row 2; specific numbers stay open.

**Context.** Existing canon (`pricing-and-onboarding.md`) frames public plans as Recovery Core / Recovery Pro / Recovery Performance + outcome fees, with the billing engine, Stripe, and outcome-fee ledger shipping in **v0.5** (ADR-0010). The GTM direction (§6–§8) reframes pricing around **managed business-memory capacity** — Starter / Operator / Growth Intelligence / Enterprise Memory System.

**Decision.**

1. **Go-forward public pricing model = capacity-based Business-Memory tiers** (Starter / Operator [featured] / Growth Intelligence / Enterprise), priced as platform fee + memory capacity + AI/automation usage + voice/transcription capacity + support, sold as a value-based retainer with pass-through-plus-margin overages. This supersedes the Recovery-Core/Pro/Performance naming **as the public model**.
2. **Revenue-Recovery outcome fees are retained as an optional layer** (consistent with ADR-0022) — outcome/performance fees may sit on top of a memory-tier retainer.
3. **Price points are NOT decided here.** Every number in GTM §6–§8 is a working estimate pending the **Phase 3 cost model** (TODO-verify), including final price points, minimum contract length, cancellation/data-export terms, and exact overage rates.
4. **Billing implementation timing is unchanged** — the pricing engine, Stripe billing, and outcome-fee ledger still ship in **v0.5 per ADR-0010**. This ADR defines *what* the model is, not *when* it is built.

**Consequences.** GTM/landing copy (Phase 2/5) can present the memory-tier model now (ranges or "contact us") while billing logic stays unbuilt until v0.5. ADR-0010 is unaffected; the open items are explicitly the numbers and contract terms, gated to Phase 3.

---

## ADR-0029 — Per-client Business Memory Vault is the canonical delivery model, activated behind the v0.4 knowledge-layer gates (extends ADR-0016)

**Status:** Accepted (2026-05-30) for the *direction*; client-facing activation remains **v0.4-gated**. **Extends ADR-0016** (adds a per-tenant layer; the operator-side Obsidian scope is unchanged). **Extended by ADR-0034** (2026-05-31): a Phase-1 *operational capture* baseline (event-ledger records) is pulled into v0.3 **without** relaxing the v0.4 knowledge / RAG gates. Resolves the *direction* of §24 row 6; activation timing stays gated.

**Context.** ADR-0016 scoped Obsidian as the **operator-side** SOP/brand-knowledge layer and explicitly **not** the per-tenant client knowledge/grounding layer, which `ROADMAP.md` gates to v0.4 behind isolation/audit/retention/PII controls. The Business-Memory offer (ADR-0022, GTM §3/§5) is built around a **dedicated per-client memory vault** (raw evidence in R2, structured memory in Neon, narrative memory in Markdown).

**Decision.**

1. **The per-client Business Memory Vault is the canonical *delivery model* for the offer** — each subscriber gets a dedicated memory container (R2 evidence + Neon records + Markdown/Obsidian-compatible narrative).
2. **It is a distinct layer from operator-side Obsidian (ADR-0016), which is unchanged.** The per-client vault holds tenant content; the operator vault holds AJ Digital SOPs/brand knowledge and carries no tenant PII.
3. **Client-facing activation is v0.4-gated.** Per-tenant ingestion of client content (and any RAG/grounding over it) ships only when the v0.4 knowledge-layer gates are in force: tenant isolation, source ownership, upload permissions, audit logging, retention policy, transcript/recording controls, PII minimization, deletion/export workflow, approved-source controls, human review for sensitive knowledge (`ROADMAP.md` Future Knowledge Layer).
4. **The vault is sold as a managed outcome, not an Obsidian install** (GTM §3) — local Obsidian access is an optional add-on, not the core deliverable.

**Consequences.** The Business-Memory delivery model is canonical and can drive GTM copy and the data architecture (R2 + Neon + narrative), while the **v0.4 gates remain hard prerequisites** before any per-tenant client content is ingested. No v0.4 control is relaxed; this ADR sets the target those gates protect. No code/ingestion is built by this ADR.

---

## ADR-0030 — Realtime voice infrastructure (gateway + Redis + orchestration) is a v0.3+/Phase-7 boundary, not v1

**Status:** Accepted (2026-05-30). Sequencing/boundary clarification; **does not retire** ADR-0013 (gateway) or ADR-0014 (Redis) as the realtime design. Builds on ADR-0024. Resolves §24 rows 8–9.

**Context.** ADR-0013 (dedicated Node.js voice gateway) and ADR-0014 (Redis ephemeral session state) define a realtime-audio architecture. ADR-0024 set OpenAI as the v1 default brain/voice/transcription and sanctioned Twilio-or-Telnyx telephony. The GTM v1 stack (§4/§10) omits the gateway and Redis; §24 rows 8–9 flagged the omission and the Twilio-vs-Telnyx detail.

**Decision.**

1. **v1 voice scope = async + basic voice/transcription via OpenAI** (per ADR-0024). v1 does **not** require the realtime audio gateway or the Redis session cache.
2. **The realtime stack — Node.js voice gateway (ADR-0013), Redis session state (ADR-0014), optional Vapi/Retell orchestration — is deferred to the realtime-voice build** (the v0.3+ provider pilot / GTM Phase 7). ADR-0013/0014 **remain the design** for that build; they are sequenced, not retired.
3. **Telephony: Twilio is the default; Telnyx is a sanctioned alternative** (per ADR-0024) behind the telephony abstraction.
4. Live wiring stays v0.3-gated (ADR-0001) with the provider-readiness gate (ADR-0012/0024) before any live traffic.

**Consequences.** A clear v1 boundary — simpler async/basic-voice path now, realtime architecture intact and scheduled for the pilot. No premature build of the gateway/Redis. No code change.

---

## ADR-0031 — Telnyx is the primary communications carrier; Twilio is failover (supersedes the Twilio-default portion of ADR-0024)

**Status:** Accepted (2026-05-31). **Supersedes the telephony-default portion of ADR-0024** (and the "Twilio edge" carried from ADR-0012). Twilio is retained as failover. Ratifies §1/§3 of [`product/responseos-communications-stack.md`](./product/responseos-communications-stack.md).

**Context.** ADR-0024 set Twilio as the default telephony edge with Telnyx a "sanctioned alternative." The CTO communications-stack report selects **Telnyx as the primary carrier** (voice, SMS, SIP, numbers, A2P) on capability and per-minute/message economics, with Twilio maintained for failover/compatibility. Application code is carrier-agnostic behind the abstraction (ADR-0001; the Communications Abstraction Layer, comms doc §2), so this is a default/routing decision, not a rewrite.

**Decision.**

1. **Primary carrier = Telnyx** — inbound/outbound voice, A2P SMS, SIP, numbers.
2. **Twilio = secondary / failover carrier** — maintained for redundancy and compatibility; **not** the default infrastructure path for MVP.
3. Both sit behind `CarrierProvider` / `SmsProvider`; **no carrier-specific logic above the adapter boundary**; Telnyx → Twilio failover must be transparent to the policy engine, tool router, and event ledger.
4. Live wiring is **v0.3-gated** (ADR-0001, ADR-0019). A2P 10DLC / number-registration ownership (platform vs per-client) is a v0.3-readiness open item.

**Consequences.** ResponseOS is not a Twilio-only platform. The `RESPONSEOS_BUILD_SOURCE.md` "Twilio edge" line and ADR-0024's telephony default are superseded; `BUILD_SOURCE` should be updated to name Telnyx primary / Twilio failover. Regulated/HIPAA-lane tenants still gate on per-provider BAA/retention review before live traffic. Mock-first (ADR-0001) holds until v0.3.

---

## ADR-0032 — Vapi is the primary AI voice orchestration layer; Retell secondary (amends ADR-0024; LLM-brain choice left open)

**Status:** Accepted (2026-05-31). **Amends ADR-0024** — promotes Vapi from "optional orchestration" to the **primary** AI voice orchestration layer. The **LLM-brain question is explicitly left OPEN** (Decision §3). Ratifies §1/§3 of the comms-stack doc.

**Context.** ADR-0024 made OpenAI the default for reasoning/basic-voice/transcription and classified Vapi/Retell as *optional* orchestration "after validation." The CTO report selects **Vapi as the primary AI voice orchestration layer** for the AI receptionist, with Retell AI as secondary/redundancy (Phase 2). Vapi orchestrates the voice agent (telephony bridge, turn-taking, tool-calls, barge-in); the underlying LLM/voice model is a separate choice.

**Decision.**

1. **Primary AI voice orchestration = Vapi** — owns AI-receptionist orchestration for the MVP/v0.3 communications stack.
2. **Retell AI = secondary AI voice runtime / redundancy** (Phase 2), behind the same `VoiceAgentProvider` abstraction (ADR-0001 / comms doc §2). No orchestration-specific logic above the adapter boundary.
3. **OPEN DECISION (preserved):** whether **OpenAI remains the LLM brain / transcription model *inside* the Vapi-orchestrated agent** (compatible with ADR-0024's model layer) or whether **Vapi owns model selection**. This ADR does **not** resolve it — ADR-0024's OpenAI-default *model* stance stands until decided. Related open item: whether the Node.js voice gateway + Redis (ADR-0013/0014) are retained behind a Vapi path or subsumed by Vapi.
4. Live wiring **v0.3-gated** (ADR-0001/0019); the provider-readiness gate (ADR-0012/0024) applies before live traffic.

**Consequences.** The orchestration layer is decided (Vapi primary, Retell secondary) while the model layer remains an explicit open decision — so ADR-0024 is **amended, not fully superseded**. If OpenAI is later confirmed as the in-Vapi brain, ADR-0024's model stance is preserved; if Vapi owns model selection, a follow-up ADR supersedes that portion. Mock-first holds until v0.3.

---

## ADR-0033 — HubSpot is the default commercial system of record; the ResponseOS ledger remains the internal SoR (re-amends ADR-0027)

**Status:** Accepted (2026-05-31). **Re-amends ADR-0027** — restores HubSpot as the *default* (client-overridable) external commercial CRM system of record. The internal-ledger SoR (ADR-0002) is unchanged. Ratifies §5 of the comms-stack doc.

**Context.** ADR-0015 named HubSpot the default external CRM SoR; ADR-0027 demoted it to "recommended, no mandated default" to align with the Business-Memory positioning. The CTO communications decision re-establishes **HubSpot as the default commercial system of record** for the MVP, because the communications stack must sync calls/SMS/AI-summaries/qualification/appointments/follow-ups into a concrete commercial CRM by default — while keeping it client-overridable.

**Decision.**

1. **Two systems of record (unchanged framing, ADR-0002):**
   - **Internal / product SoR = the ResponseOS event ledger.** ROI, audit, attribution, replay recompute from it, never from a vendor payload. **Unchanged.**
   - **Default external commercial SoR = HubSpot**, overridable per client (GHL, Salesforce, or another CRM).
2. **Commercial activity** — calls, SMS events, AI summaries, lead-qualification outcomes, appointment requests, follow-up status — syncs into HubSpot by default via the canonical mapping (`lib/providers/*`).
3. **GHL remains a supported connector, not core infrastructure** — **no dependency on GHL LC Phone** (telephony is Telnyx/Twilio per ADR-0031). Consistent with ADR-0007.
4. A client requiring a different CRM overrides the default; history survives a CRM swap because facts recompute from the ledger.

**Consequences.** Restores a concrete default commercial CRM for the comms MVP while preserving client choice and the ledger's primacy. ADR-0027's "no mandated default" is re-amended to "HubSpot default, client-overridable"; the internal-ledger SoR and tenant-ownership story (ADR-0002, ADR-0027) are intact. No code change. Webhook signature validation (ADR-0009) unchanged.

---

## ADR-0034 — Phase-1 Business Memory baseline: operational capture into the event ledger; the v0.4 knowledge/RAG gates are NOT relaxed (extends ADR-0029)

**Status:** Accepted (2026-05-31). **Extends ADR-0029** — pulls a lightweight Business Memory *capture* into Phase-1/v0.3 **without relaxing the v0.4 per-tenant knowledge gates** (ADR-0016, ROADMAP Future Knowledge Layer). Ratifies §4 of the comms-stack doc.

**Context.** ADR-0029 made the per-client Business Memory Vault the canonical delivery model but kept client-facing knowledge activation v0.4-gated. The CTO report pulls a **lightweight Business Memory baseline earlier** so every AI receptionist interaction is captured as structured business memory from the comms MVP — establishing the data-capture foundation without advanced retrieval.

**Decision.**

1. **Phase-1 (v0.3) Business Memory baseline = structured operational capture into the event ledger** for every AI receptionist interaction: call transcript, call summary, lead/contact identity, intent, qualification status, appointment request, follow-up requirement, source channel, CRM-sync status, next recommended action.
2. **Operational capture only.** It builds on the already-shipped call-intelligence substrate (conversations / transcripts / qa-logs) and the internal SoR (ADR-0002). It is **not** a vector index, embeddings store, RAG runtime, semantic retrieval, or per-tenant agent-grounding surface.
3. **The v0.4 gates are NOT relaxed.** Per-tenant *knowledge ingestion, retrieval, vector search, and RAG/grounding* remain **v0.4-gated** behind the full controls (tenant isolation, source ownership, upload permissions, audit logging, retention, transcript/recording controls, PII minimization, deletion/export, approved-source controls, human review) per `ROADMAP.md` and ADR-0016/ADR-0029.
4. Tenant isolation (every read/write scoped by `account_id`) applies to captured memory exactly as to all ledger data.

**Consequences.** The capture foundation that makes Business Memory a differentiator ships earlier, while the gated knowledge/RAG behaviours stay v0.4. **No new database models, no vector/embeddings dependency, no RAG runtime, and no client upload surface are authorized by this ADR.** Mock-first / v0.3 live-wiring gates hold.

---

## ADR-0035 — Demo go-to-market decisions: CTA "Revenue Recovery Demo", primary vertical General Home Services, Hybrid demo format

**Status:** Accepted (2026-05-31). Operator decision at the post-product-definition gate. Resolves the CTA / vertical / demo-format open decisions threaded through the demo docs. **Does not** resolve the ADR-0032 architecture open decisions (OpenAI-in-Vapi; gateway/Redis), which remain open.

**Context.** With the ResponseOS product-definition layer complete (demo narrative, demo-content assets, wireframe spec, landing-page copy, sales talk track + cheat sheet, OG/social spec), three open decisions gated the first non-docs build task. The operator made them at the explicit decision gate.

**Decision.**

1. **Final primary CTA = "Revenue Recovery Demo."** The canonical CTA across landing-page copy, talk track, cheat sheet, and OG/social card (OG headline Variant A pairs with it). "Revenue Memory Diagnostic" and "Missed Revenue Audit" are retired as the primary CTA (may survive as secondary/alt framings).
2. **Primary vertical = General Home Services**, with **Florida Ramp & Lift (accessibility / mobility equipment) as the anchor case study.** This keeps TAM broad while leveraging real-world experience; the existing accessibility-equipment demo assets become the flagship example *within* the home-services pitch.
3. **Demo format = Hybrid** — a **recorded** demo for marketing / top-of-funnel and a **clickable** demo for sales conversations. The **clickable static demo route** is the first implementation milestone either way.

**Consequences.** The demo docs' "open decisions" sections for CTA / vertical / format are now resolved by this ADR (the docs may reference it incrementally; this ADR is authoritative). **This ADR authorizes the *first non-docs build task* — a clickable static demo route — under a strict scope:** a visual click-through (Revenue Recovery Overview → Call Intelligence → Lead/Opportunity → Business Memory → Follow-Up Queue) bound to the **existing mock demo assets**, per the wireframe spec and Brand 2.0. It explicitly does **not** authorize Telnyx, Vapi, HubSpot, SMS, live calls, provider integrations, deploy work, or relaxing the v0.4 Business Memory / RAG / vector gates. Mock-first (ADR-0001) and v0.3 live-wiring gates hold.

---

## ADR-0036 — v0.3 provider-stack open decisions resolved as a planning baseline (resolves the §4 open items of the provider-readiness spec; closes the ADR-0032 open decisions; **no implementation authorized**)

**Status:** Accepted (2026-06-02) as **planning decisions only.** Resolves the open decisions in [`product/responseos-v0.3-provider-readiness.md`](./product/responseos-v0.3-provider-readiness.md) §4 and the open items in **ADR-0032 §3** (LLM brain; gateway/Redis). Confirms ADR-0031 (carrier) and ADR-0033 (CRM SoR). **No schema change, provider adapter, env var, secret, account configuration, deploy, or v0.3 implementation is authorized by this ADR** — those remain gated (ADR-0001, ADR-0019) behind a separate, explicitly-approved PR.

**Context.** The v0.3 Provider Stack Readiness Spec (#72) enumerated the provider-stack decisions that gate a future communications build: the in-Vapi LLM/transcription brain, the custom Node voice gateway + Redis relationship, Telnyx enum/schema representation, A2P ownership, the scheduling baseline, and Sendblue/iMessage scope. This ADR settles them as a **planning baseline** so the direction is unambiguous, while keeping every implementation step gated.

**Decision.**

1. **Vapi remains the primary AI voice orchestration layer** (confirms ADR-0032); Retell AI stays secondary/redundancy.
2. **OpenAI is the preferred LLM / transcription brain *inside* Vapi where it is configurable;** Vapi-owned model selection is the **fallback** only if OpenAI-in-Vapi is not configurable. This resolves the ADR-0032 §3 open decision in favor of *OpenAI-in-Vapi-preferred*.
3. **The custom Node.js voice gateway + Redis (ADR-0013/0014) are deferred for the first v0.3 slice** unless provider-readiness testing proves them necessary (e.g., barge-in / media-stream control Vapi does not cover). Deferred, not removed — revisited per readiness testing.
4. **Telnyx primary / Twilio failover remains the carrier baseline** (confirms ADR-0031). **Any implementation or schema change** (adding `telnyx` to `CallProvider`/`SmsProvider`/`ProviderConnectionProvider`, adapters, env) **requires a separate approved PR** — this ADR does not make it.
5. **MVP A2P 10DLC ownership is platform-owned** (ResponseOS-registered brand/campaign); per-client / BYO registration is a future option. Resolves the ADR-0031 A2P-ownership open readiness item.
6. **Scheduling baseline is Cal.com, with Google Calendar compatibility;** GHL remains an optional connector (consistent with ADR-0033 and ADR-0007). Resolves the readiness-spec scheduling open item.
7. **Sendblue / iMessage is out of v0.3** and remains future / premium research only.

**Consequences.** The provider-stack direction for a future v0.3 communications slice is now unambiguous, while the **gate is unchanged**: no live providers, schema, env, secrets, accounts, or deploy ship under this ADR. It updates two stale prose docs to match the baseline — `docs/README.md` (the "Twilio edge · Grok Voice primary …" stack summary) and `docs/SECURITY.md` (the standard-mode line + the webhook-signature table, which now lists the planned Telnyx/Vapi validation). `RESPONSEOS_BUILD_SOURCE.md` was already reconciled to the carrier/orchestration/CRM canon (#49); its remaining resolved-decision annotations are updated by the ADR-0037 reconciliation. The v0.4 knowledge / RAG / vector gates (ADR-0016/0029/0034) are untouched. Mock-first (ADR-0001) holds. The first actual provider work begins only with a separate, explicitly-authorized, scoped PR.

---

## ADR-0037 — v0.3 MVP scheduling baseline is Calendly; Cal.com deferred as the platform-native option (amends ADR-0036 decision 6; planning only)

**Status:** Accepted (2026-06-02) as a **planning decision. Amends ADR-0036 decision 6** (which set Cal.com as the scheduling baseline). **No implementation authorized** — no Calendly adapter, env var, secret, schema change, account setup, or live integration ships under this ADR (v0.3-gated, ADR-0019).

**Context.** ADR-0036 set Cal.com as the platform-native scheduling baseline and flagged the Cal.com-vs-Calendly question for a short decision note. For the v0.3 MVP the operator selects **Calendly** as the lower-friction path: reliable booking links, embeds, calendar sync, webhooks, HubSpot-friendly GTM workflows, and a familiar UX at low per-seat cost — without turning scheduling into a platform-infrastructure project. Cal.com's platform/API tier is more infrastructure-oriented and is better justified once the product needs deeper embedded scheduling control.

**Decision.**

1. **Calendly = v0.3 MVP scheduling baseline** — booking links, embeds, calendar sync, webhooks, HubSpot-friendly scheduling workflows.
2. **Cal.com = deferred platform-native option** — reconsider after v0.3 proves the scheduling workflow needs deeper embedded control.
3. **Google Calendar compatibility remains required** regardless of provider.
4. **A `SchedulingProvider` abstraction is retained** (consistent with the CAL doctrine, ADR-0001) — the platform binds to neither vendor directly, so Calendly ↔ Cal.com is a swap, not a rewrite.
5. **Planning only.** No live Calendly integration, env vars, secrets, schema work (the `CalendarProvider` enum is unchanged), provider adapter, or account setup is authorized; that requires a separate, explicitly-approved PR.

**Consequences.** Amends ADR-0036 decision 6 (scheduling baseline Cal.com → Calendly for the MVP; Cal.com deferred). The accompanying reconciliation updates the stale `RESPONSEOS_*` prose (`RESPONSEOS_BUILD_SOURCE.md`, `RESPONSEOS_PRD.md`, `RESPONSEOS_ROADMAP.md`) to defer to ADR-0031/0032/0033/0036/0037 rather than the older Grok/OpenAI-Realtime/Twilio/gateway/Redis framing. Mock-first (ADR-0001) and the v0.3 live-wiring gate (ADR-0019) hold.

---

## ADR-0038 — Doppler is the opt-in secrets-injection tool for local + runtime env

**Status:** Accepted (2026-06-03). Tooling decision. **Does not change ADR-0001 (mock-first) or ADR-0019 (v0.3 live-wiring gate)** — it adds a way to *supply* env vars, not permission to wire live providers.

**Context.** Secrets reach the app through env vars, today via a hand-maintained `.env.local` copied from `.env.example`. That works but spreads decrypted secrets across contributor machines, has no rotation or access story, and makes "who has which key" untrackable. The operator installed the Doppler CLI and asked to wire it into the repo for handling secrets. The constraint is the load-bearing env policy: **no real secrets in the repo**, and **the app must boot with zero credentials** (every provider falls back to mock when its env vars are missing).

**Decision.**

1. **Doppler is the secrets-injection layer, and it is opt-in.** A committed `doppler.yaml` pins the project/config mapping only (no secret values, same spirit as `.env.example`). Secrets are pulled at runtime via `doppler run`, exposed through `*:doppler` npm scripts (`dev:doppler`, `build:doppler`, `start:doppler`, `secrets:check`).
2. **The plain scripts and the `.env.local` flow stay fully supported.** Doppler is never required; mock-fallback `npm run dev` and `.env.local`-backed `npm run dev` both keep working.
3. **The mock-first guarantee is untouched.** With no secrets present (no Doppler, no `.env.local`) the app boots on mock adapters per ADR-0001. Injecting a real key only activates that key's already-existing adapter path (e.g. `CLERK_SECRET_KEY`) — it authorizes **no** new live provider integration.
4. **No decrypted secrets may reach the repo.** Doppler local state and fallback caches are gitignored (`.doppler/`, `*.doppler.fallback.json`). The "no real secrets in the repo, ever" rule is unchanged.
5. **CI is unchanged.** The `validate` / `integration` jobs inject their own env (Postgres for integration) and do not depend on Doppler. Adopting Doppler in CI/CD, if ever, is a separate decision.

**Consequences.** Contributors get centralized, rotatable, access-controlled secrets without maintaining `.env.local`, while every existing guarantee holds: zero-credential boot, mock-first, no secrets in the repo, and the v0.3 gate. Cost: contributors who opt in need the Doppler CLI and a one-time `doppler login` + `doppler setup`; the project/config names in `doppler.yaml` must match the Doppler workplace. This ADR is tooling only — it ships no provider adapter, schema change, env var, secret, account configuration, or deploy.

---

## ADR-0039 — `RESPONSEOS_REQUIRE_AUTH` is the fail-closed auth gate, at both the edge and the session

**Status:** Accepted (2026-07-28). Security posture decision. **Does not change ADR-0001 (mock-first) or ADR-0019 (v0.3 live-wiring gate)** — it adds an opt-in way to *harden* a deploy, and authorizes no deploy.

**Context.** With no `CLERK_SECRET_KEY`, `getCurrentSession()` fell back to the placeholder `aj_admin` dev session — a privileged, cross-tenant identity — and `proxy.ts` passed every request straight through. On a hosted surface that is a fail-open hole (gap **D2** in `GTM_GAP_AND_DEPLOYMENT_PLAN.md`): an anonymous visitor reaches the operator console and tenant consoles. Two open PRs fixed it independently and incompatibly. PR #94 gated on `NODE_ENV === "production"` and fixed the edge (`proxy.ts` redirect) plus the session. PR #96 gated on an explicit `RESPONSEOS_REQUIRE_AUTH` env var and fixed only the session.

**Decision.**

1. **The trigger is the explicit `RESPONSEOS_REQUIRE_AUTH` env var, not `NODE_ENV`.** Set (any value other than `0`/`false`) means "this deploy must authenticate." `NODE_ENV === "production"` is the wrong signal here because the flagship near-term deliverable — the mock-safe hosted demo (ADR-0019) — *is* a production build whose entire purpose is rendering populated mock data. Verified: with the flag set, the prerendered `/client/*` pages render `EmptyState` instead of the mock tenant financials; gating on `NODE_ENV` would strip the demo of its content.
2. **Both layers fail closed, on the same trigger.** `lib/auth/session.ts` returns no session; `proxy.ts` redirects non-public paths to `/`. The session layer alone only produces empty authenticated shells — the edge redirect is what actually keeps anonymous visitors off the consoles. Keeping both is deliberate defence in depth, not redundancy.
3. **Unset is byte-identical to before.** Local dev, CI, `next build`, and the mock-safe demo keep the ADR-0001 mock-first fallback unchanged. Verified by comparing prerendered output before and after (`client/dashboard.html` 34,930 bytes both ways).
4. **The predicate lives in `lib/auth/auth-required.ts`, dependency-free.** `proxy.ts` runs in the edge runtime and must not import `lib/auth/session.ts`, which pulls in the server-only guard, the Prisma client, and the Clerk server SDK.
5. **`/audit` and `/trust` are public routes.** Both are prospect-facing marketing pages in the public nav, and `/audit` is the lead-capture form; neither was in the public set, so a Clerk-enabled deploy would have put the top of the funnel behind sign-in. Classified as `PUBLIC_EXACT` (like `/pricing`), not prefixes.

**Consequences.** Supersedes the `NODE_ENV`-gated approach in PR #94; that PR's session and proxy changes should be dropped in favour of this gate when it is reconciled, and its `/audit` + `/trust` fix is carried here. A hosted deploy must now set `RESPONSEOS_REQUIRE_AUTH=1` explicitly — the cost of the opt-in trigger is that forgetting it leaves the deploy fail-open, so it belongs in the demo-deploy checklist alongside the Clerk keys. This ADR ships no deploy config, no secret, and no provider wiring.
## ADR-0040 — ResponseOS product boundary: a managed revenue-recovery and operational-intelligence layer, not a CRM, FSM, carrier, or automation platform

**Status:** Proposed (2026-07-31), pending operator ratification with [`strategy/responseos-platform-doctrine-v1.md`](./strategy/responseos-platform-doctrine-v1.md). Consolidates the boundary language scattered across ADR-0007 (QuoteIQ), ADR-0015/0027/0033 (CRM ownership), and ADR-0022 (positioning) into one testable rule. **Documentation only — no code, schema, env, provider, or deploy change.**

**Context.** The repo has stated its boundary in fragments: QuoteIQ is a connector not a system of record (ADR-0007); the external CRM is client-owned and pluggable (ADR-0027, ADR-0033); positioning composes Business Memory with Revenue Recovery (ADR-0022). Nothing states the boundary as a single rule a proposal can be tested against, so feature requests that would drift ResponseOS into CRM, FSM, telecom, or generic-automation territory have no crisp basis for rejection. The platform doctrine makes the boundary explicit and reviewable.

**Decision.**

1. **ResponseOS is a managed revenue-recovery and operational-intelligence system for founder-led service businesses.** Its job is to capture inbound demand, prevent silent lead loss, recover conversations after missed calls, qualify opportunities, preserve customer and operational context, route or schedule follow-up, measure estimated and verified outcomes separately, and give the owner an accountable operational view.
2. **ResponseOS is explicitly not:** a general-purpose CRM · a field-service management platform · a native telecom carrier · a native voice-foundation-model provider · a generic automation builder · a replacement for ServiceTitan, Housecall Pro, Jobber, HubSpot, or GoHighLevel · a crypto or blockchain platform · an agent marketplace · a tokenized business network · an enterprise BI replacement today · a production-proven revenue-attribution system until live reconciliation is demonstrated.
3. **The build-vs-buy test.** If a capability remains valuable when the underlying vendor is swapped, build it. If it is valuable only because a specific vendor provides it, buy it and put it behind an adapter (doctrine §11).
4. **A proposal that moves ResponseOS toward any item in decision 2 requires a superseding ADR**, not a backlog ticket — regardless of customer demand (doctrine §19).

**Consequences.** Scope creep now has a named cost: an ADR. The doctrine's §21 review checklist operationalizes the boundary as fifteen questions every architecture proposal answers. ADR-0007, ADR-0027, and ADR-0033 are unchanged and remain the specific decisions on QuoteIQ and CRM ownership; this ADR generalizes them. No product behavior changes.

---

## ADR-0041 — Founder Intelligence architecture: a nine-layer progression from Communications to Trust Infrastructure

**Status:** Proposed (2026-07-31), pending operator ratification with the platform doctrine. Extends ADR-0002 (event-ledger-first) and ADR-0022 (positioning). **Does not relax any v0.4 knowledge/RAG gate** (ADR-0016, ADR-0029, ADR-0034). **Documentation only.**

**Context.** ADR-0022 established that Business Memory is the mechanism and recovered revenue the proof, but the architecture between "capture a call" and "advise a founder" was never named. Without a layer model, every intelligence-adjacent proposal argues from scratch, and there is no shared vocabulary for saying "that belongs three layers above where we are."

**Decision.**

1. **The long-term architecture is a nine-layer progression:** (1) Communications Capture → (2) Business Memory → (3) Operational Models → (4) Revenue Intelligence → (5) Operational Intelligence → (6) Verified Outcomes → (7) Benchmark Intelligence → (8) Founder Intelligence → (9) Trust Infrastructure. Each layer's purpose, contents, output, and current status are specified in doctrine §8.
2. **Layer 6 (Verified Outcomes) is the load-bearing layer.** Nothing above it is defensible without it. Every state change in the outcome chain preserves source, timestamp, evidence, actor, tenant, confidence, attribution status, and correction history.
3. **Layer 7 (Benchmark Intelligence) must never expose client-specific data** and requires tenant isolation, privacy review, aggregation thresholds, a lawful processing basis, de-identification, small-cohort suppression, documented metric definitions, data-quality gates, and confidence ranges.
4. **Layer 8 (Founder Intelligence) produces evidence-linked recommendations, not autonomous executive authority** (ADR-0043 §governance, doctrine §16).
5. **Layer status must be stated wherever a layer is described.** Today, Layers 1, 2, 4, and 9 are `PARTIALLY_SHIPPED` (substrate only) and Layers 3, 5, 6, 7, 8 are `DOCUMENTED_ONLY`.
6. **The intelligence flywheel becomes defensible only when it contains real operating data, verified outcomes, durable metric definitions, evidence-linked interventions, lawful cross-client aggregation, vertical-specific models, and repeatable findings.** Documentation, schemas, prompts, and dashboards do not by themselves create a moat.

**Consequences.** Proposals gain an address ("this is a Layer 5 feature; we are at Layer 1") and a sequencing argument. The v0.4 knowledge-layer gates are untouched — Layer 2 remains split between the Phase-1 operational capture permitted by ADR-0034 and the per-tenant knowledge/RAG behavior that stays v0.4-gated. No schema, model, or pipeline is authorized by this ADR.

---

## ADR-0042 — Revenue attribution states: estimated, influenced, qualified, booked, completed, and collected revenue remain distinct

**Status:** Proposed (2026-07-31), pending operator ratification with the platform doctrine. Extends ADR-0002. Interacts with ADR-0010 (billing in v0.5). **No schema change is authorized** — introducing these states requires a separate approved PR.

**Context.** `RevenueMetrics` carries exactly two revenue figures: `estimated_recovered_revenue` and `verified_recovered_revenue`. The commercial model already supports outcome fees keyed to `per_verified_recovered_lead` and `pct_recovered_revenue` (`Engagement.outcome_fee_kind`). A two-value model cannot express the difference between a lead we influenced, a job that was booked, a job that was completed, and cash that was collected — yet outcome fees are priced against exactly those distinctions. Charging on an attribution model the system cannot represent is the single largest commercial-integrity risk in the product.

**Decision.**

1. **Canonical revenue states:** `ESTIMATED`, `INFLUENCED`, `QUALIFIED`, `BOOKED`, `COMPLETED`, `COLLECTED`, `DISPUTED`, `REJECTED`, `UNATTRIBUTED`. These are distinct and never collapsed in storage, reporting, or copy.
2. **Every revenue claim carries:** amount, state, evidence source, originating event, intervention, customer or lead, timestamp, confidence, attribution rule, human verification status, and correction history.
3. **Four invariant rules.** Estimated revenue is not recovered revenue. Booked revenue is not collected revenue. Influence is not causation. **Outcome fees must not be charged until the attribution and dispute process is operationally validated** (doctrine §18 Revenue Gate).
4. **Reconciliation starts manual.** The smallest useful loop — one pilot, reconciled by hand, with a measured error rate — is built before any generalized attribution infrastructure.
5. **Planning only.** No Prisma model, enum, migration, or reporting change ships under this ADR. The existing two-column shape stands until a separate approved PR implements the state set.

**Consequences.** The commercial model and the data model are placed on a path to agreement. ADR-0010's v0.5 billing timing is unchanged; this ADR constrains *what* the billing engine may bill on when it is built. Until the Revenue Gate passes, `pct_recovered_revenue` and `per_verified_recovered_lead` outcome fees are not billable, and "ResponseOS proves every recovered dollar" remains a prohibited claim (doctrine §20).

---

## ADR-0043 — Provider portability is proven by two adapters or one live provider plus a tested fallback — not by an interface plus a mock

**Status:** Proposed (2026-07-31), pending operator ratification with the platform doctrine. **Extends** ADR-0001 (mock-first) and the provider-stack decisions ADR-0031 / ADR-0032 / ADR-0033 / ADR-0036 / ADR-0037 — it does **not** re-decide the stack and creates no duplicate provider ADR. **Documentation only.**

**Context.** The provider stack is fully decided (Telnyx primary / Twilio failover, Vapi primary / Retell secondary, OpenAI preferred in-Vapi brain, HubSpot default commercial SoR, Calendly MVP scheduling). What is not decided is the **evidentiary standard** for the claims that stack invites. The communications-stack document describes the Communications Abstraction Layer as "the platform's primary infrastructure moat," while the repository contains exactly one provider interface (`lib/providers/voice/`) with one mock adapter and no consumer. `ProviderConnectionProvider` still enumerates a superseded stack and contains neither `telnyx` nor `calendly`. Without a standard, "provider-independent" gets claimed on the strength of a TypeScript interface.

**Decision.**

1. **Portability is not proven until either** (a) at least two adapters implement the same interface, **or** (b) one live provider and one verified fallback path have been tested end to end.
2. **A TypeScript interface plus a mock adapter is architecture preparation, not proven provider portability.** Until decision 1 is satisfied, "ResponseOS is provider-independent" and "the abstraction layer is our moat" are prohibited claims (doctrine §20, §10.6).
3. **The provider-abstraction rule is restated and retained:** ResponseOS controls canonical event schemas, business rules, memory, attribution, audit history, workflow state, and outcome reporting; providers control only their commodity function; provider payloads are translated to canonical events at the adapter boundary; no provider-specific logic exists above it.
4. **Provider review triggers.** Reassess a provider when reliability falls below target, cost materially harms unit economics, required compliance support is unavailable, feature access becomes restrictive, vendor lock-in threatens canonical data ownership, latency harms the customer experience, pricing changes materially, the provider becomes a direct strategic competitor, or required functionality cannot be implemented cleanly. **A trigger opens a review; a review produces an ADR.** Preference alone changes nothing.
5. **Bundling is not a sufficient reason to replace a provider.** A change must be justified by measurable reliability, materially better economics, required functionality, reduced implementation complexity, stronger compliance posture, superior control of data and workflows, or proven architectural fit.
6. **Candidate systems are classified by role, not treated as interchangeable** — carrier infrastructure, voice-agent infrastructure, business phone system, unified communications, contact center, receptionist product, CRM platform, workflow platform, direct competitor, distribution gatekeeper, or integration partner. A system may be a partner in one role and a competitor in another.

**Consequences.** The stack decisions are unchanged and unduplicated. What changes is what may be *said* about them, and what evidence a future provider swap must produce. The `telnyx` / `calendly` schema gap remains governed by ADR-0036 §4 — a separate approved PR — and is now recorded in the doctrine as the canonical illustration that a ratified decision is not an implementation.

---

## ADR-0044 — Trust Infrastructure: ResponseOS is blockchain-compatible, not blockchain-dependent

**Status:** Proposed (2026-07-31), pending operator ratification with the platform doctrine. Ratifies the recommendation of [`research/RESPONSEOS_WEB3_BLOCKCHAIN_OPPORTUNITY_RESEARCH.md`](./research/RESPONSEOS_WEB3_BLOCKCHAIN_OPPORTUNITY_RESEARCH.md) as decision. Extends ADR-0002. **Authorizes no implementation** — no hashing, signing, anchoring, SDK, dependency, schema change, or wallet surface.

**Context.** The Web3/blockchain research report evaluated crypto opportunities against the current architecture and concluded that ResponseOS should not become a crypto product; that the real opportunity is verifiable trust infrastructure for AI-operated business communications; and that the correct first step is conventional cryptography in Postgres, not a chain. That conclusion has lived as research with no decision of record, leaving the door open for blockchain to re-enter as a positioning idea.

**Decision.**

1. **Canonical principle: ResponseOS is blockchain-compatible, not blockchain-dependent.**
2. **The internal system of record is and remains the ResponseOS event ledger** (ADR-0002, ADR-0033 §1). **Blockchain must never become the system of record for private operational data.**
3. **Architecture:** business systems → canonical events → evidence and audit history → internal verification → optional verification adapters → external ledger or blockchain, if ever justified. Each arrow is a boundary, not a coupling.
4. **Sequenced path.** *Level 1* — an append-only proof layer in Postgres using canonical JSON, SHA-256 hash chains, Ed25519 signatures, tenant-scoped signing keys, and signed exports. *Level 2* — optional external anchoring of a Merkle root or timestamped commitment, **only** if a concrete buyer, regulatory, insurance, audit, or partner requirement exists. Level 1 is a Phase-7 candidate; neither level is authorized here.
5. **Prohibited current scope:** tokens · NFTs · public-chain customer records · customer wallet onboarding · crypto payments as a dependency · DAO governance · speculative assets · blockchain-first architecture · smart contracts in the MVP · **Web3 positioning in market-facing copy**. "ResponseOS supports blockchain verification" is a prohibited claim.
6. **No PII, phone number, customer name, transcript, recording, CRM payload, provider secret, or payment detail may ever be written to a public chain or public decentralized storage.**
7. **Agent-action provenance is part of this layer, not of the intelligence layers.** The record set required of every agent action — actor, agent identity, model and version, prompt or policy version, tool, inputs, output, confidence, approval state, timestamp, tenant, correction history — is a Trust Infrastructure obligation. `AuditLog` today carries actor, role, category, reason, before/after refs, IP, and user agent; agent identity, model version, prompt version, confidence, and approval state are absent. Closing that gap is Phase-7 work and blocks no earlier phase.

**Consequences.** Blockchain is settled as an optional, deferred, externally-justified adapter rather than a recurring strategic question. The strongest identified moat — a provider-neutral, replayable, exportable proof graph — is placed inside the existing event-ledger discipline instead of requiring a new vendor category. Research tracks (DID/VC, C2PA, AP2/x402, anchoring networks) remain research. Mock-first (ADR-0001) and the v0.3 gate (ADR-0019) are unchanged.
## ADR-0045 — v0.3 live-call demo slice: Telnyx-first, Sent.dm-assisted, inbound first

**Status:** Accepted (2026-07-05) as a scoped v0.3 planning decision. **No provider adapter, schema migration, env var, secret, account configuration, webhook mutation, or live call cutover is implemented by this ADR.**

**Context.** The public ResponseOS demo now proves deployment and mock walkthrough mechanics, but the operator wants a lead to experience the core product promise through live telephony: calling a ResponseOS number and optionally requesting an outbound demo call. That is a meaningful scope change from mock-only demo to live-provider demo traffic, so it must be recorded before implementation.

**Decision.**

1. The live-call demo uses a **dedicated ResponseOS demo number**, never the operator's personal number.
2. The first implementation slice is **inbound call demo first**: lead calls the demo number, AI answers, qualifies, and writes verified events into the ResponseOS demo account.
3. The outbound "call me now" journey is **second** and requires explicit consent, rate limiting, abuse controls, a daily spend cap, and a kill switch before any public form can initiate calls.
4. The demo runs against a **demo-only tenant/account**. Public requests must never supply or override `accountId`; server code owns demo account resolution.
5. Webhook signature validation remains mandatory before any business mutation (ADR-0009). Invalid or stale provider webhooks must be rejected before parsing/mutation and logged to the security/audit stream.
6. The live-call demo stack is **Telnyx-first, Sent.dm-assisted, Vapi optional**:
   - Telnyx owns the phone path: dedicated demo number, inbound/outbound voice, call-control events, and signed call webhooks.
   - Sent.dm owns verification and follow-up messaging: OTP/consent confirmation, post-call recap, demo links, and fallback messaging.
   - Vapi stays optional behind `VoiceAgentProvider`, introduced only if Telnyx AI Assistant cannot satisfy the first demo conversation.
7. The broader provider baseline remains ADR-0031/0032/0036. This demo-slice decision tests whether the first live demo can ship with fewer vendors; it does not reverse Vapi's broader v0.3 orchestration role.

**Consequences.** v0.3 now has a concrete first live-provider experience target: a bounded public demo, not a general production cutover. The slice is allowed to be specified and broken into implementation PRs, but each implementation step still needs its own scoped approval and must carry tests for signature validation, tenant isolation, kill switch behavior, Sent.dm idempotent messaging, and outbound abuse controls. This ADR does not authorize live CRM sync, billing, HIPAA-ready behavior, or use of real client data.

---

## ADR-0046 — The internal demo tenant is a first-class account, not a second application; career truth stays outside ResponseOS

**Status:** Accepted (2026-08-11) as an implementation decision. Extends ADR-0001 (mock-first) and ADR-0002 (event-ledger-first); does not relax ADR-0019 (v0.3 gate) or the v0.4 knowledge-layer gates in [`ROADMAP.md`](./ROADMAP.md).

**Context.** ResponseOS needs a reference tenant it can dogfood, demonstrate, and regression-test against — one that behaves like a paying customer's account rather than a presentation layer built beside the product. The obvious failure modes are (a) a parallel demo application with its own data path, (b) a demo tenant that quietly bypasses isolation or audit "because it's ours", and (c) letting career-specific truth (resume, employers, projects, certifications) migrate into the ResponseOS domain model, which would turn a communications platform into a career system.

**Decision.**

1. **The reference tenant is an ordinary `Account`.** `Tyrone Nelms` / `tyrone-nelms` is seeded through the same schema, accessors, session scoping, audit trail, and provider abstractions as any customer tenant.
2. **Classification is administrative only.** `Account.account_type` (`customer` / `internal` / `internal_demo` / `sandbox`) drives **reporting exclusion and console labelling**. It must never gate tenant isolation, auth, audit logging, provider resolution, workflow execution, or any other runtime behaviour. There is no `if (internal_demo)` branch in the data layer.
3. **Reporting split.** Non-`customer` tenants are excluded from cross-tenant revenue rollups and never count as paid customers or as recovered customer revenue. Scoped per-tenant reads are untouched — operational usage, provider cost, QA, and reliability metrics still measure the demo tenant, which is the point of dogfooding.
4. **Career truth is external.** Work history, projects, skills, education, and certifications reach ResponseOS through `ProfessionalKnowledgeProvider`; downstream career workflows are reached through `ProfessionalHandoffProvider` (`professional.opportunity.created`, `professional.escalation.requested`). Neither side imports the other's data model. Career OS is not vendored, mirrored, or modelled in this schema.
5. **Verified-only answering.** Every knowledge record carries a `verified` flag. A record that is not verified — and does not answer the category actually asked about — is never spoken. The receptionist's remaining paths are a fallback line, a refusal, an escalation, or a calendar tool lookup. No branch improvises a professional fact (AGENTS.md status rules; doctrine §20 and §2.2).
6. **Escalation is structural.** Compensation, consulting rates, and references escalate by default. An `AgentProfile` policy may narrow that to a refusal; it can never widen it to an answer. A malformed stored policy resolves to the strict default.
7. **Reuse over duplication.** `Appointment`, `Call`, `CallSegment`, `CallTranscript`, `Conversation`, `SmsMessage`, `QaLog`, `WorkflowRun`, and `AuditLog` carry the demo tenant's interactions unchanged. Only two tables are added: `AgentProfile` (which persona answers, and under what policy) and `ProfessionalOpportunity`.
8. **`ProfessionalOpportunity` does not reuse `LeadEvent`.** The `LeadEvent` / `LeadQualification` vocabulary is home-services shaped — quote requests, property type, service-area match, job won/lost — and does not describe a hiring conversation. Extending it would have distorted a customer-facing model to fit an internal tenant.
9. **Account configuration lives on the agent profile.** ResponseOS has no account-settings mechanism today, and this feature is not the right reason to invent a generic settings blob on `Account`. Disclosure policy, allowed appointment types, allowed asset types, and the knowledge fallback mode are stored per profile in `AgentProfile.system_policy_json`; the account-level default is `AgentProfile.is_default`.
10. **Mock-first is preserved.** Both new adapters omit `createLive`, so they resolve to the fixture/no-op implementation even when `CAREER_OS_API_KEY` or `CAREER_OS_WEBHOOK_URL` is set. The whole tenant — knowledge lookup, qualification, scheduling, opportunity capture, workflow record, audit trail — runs with zero credentials and makes no network call.

**Known conflicts with the originating specification, resolved in favour of canonical architecture.**

- The build spec proposed seeding a named real company as the example recruiter opportunity. `prisma/seed.ts` documents a fake-only rule, and a fabricated record implying a real company's recruiter is exactly the kind of claim doctrine §20 prohibits. The seed uses a synthetic company on an `.example` domain instead.
- The build spec's fixture implied answerable career content. Fabricating employers, dates, degrees, or certifications is prohibited, so the fixture ships those records as **unverified placeholders**: the grounding, fallback, and escalation paths are fully exercised, and the receptionist declines every unverified career claim until the account owner supplies canonical content or the Career OS adapter lands. This is a deliberate, tested default, not missing data.
- The spec's canonical fallback line names the account owner inline. The shared helper takes the owner name as an argument so no demo identity is compiled into core logic.

**Consequences.** ResponseOS gains a reference tenant that proves the platform on itself, and a claim-authority boundary that makes the honest answer the default one. The cost is real: until Career OS (or the owner) supplies verified records, the receptionist answers most career questions with the fallback line. That is the correct behaviour for an unsourced claim, and flipping it on is a data change, not a code change. `ProfessionalKnowledgeProvider` and `ProfessionalHandoffProvider` each have exactly one adapter, so per ADR-0043 they are **architecture preparation, not proven provider portability** — nothing here licenses a provider-independence claim.

---

## ADR-0047 — The first prospect proof is an isolated, supervised post-call evidence chain

**Status:** Accepted (2026-08-18) for repository implementation. Platform provisioning, secret injection, Telnyx/HubSpot account mutation, deployment, number exposure, and prospect release remain separate operator gates.

**Context.** Keys alone could not produce a live demonstration because both carrier and CRM factories were mock-only. The smallest credible proof does not require ResponseOS to control realtime audio: Telnyx AI Assistant can own the conversation while ResponseOS verifies and persists post-call evidence, then synchronizes a bounded commercial record into a HubSpot developer test account.

**Decision.**

1. Two isolated non-production lanes are required: authenticated provider-free `responseos-staging-mock`, and supervised `responseos-live-demo` with its own database, Clerk application, HubSpot test account, and Telnyx demo resources.
2. Telnyx webhook ingestion is enabled only when `RESPONSEOS_LIVE_TELNYX_INGEST_ENABLED=true` and the verification key, server-owned demo account, and demo number are configured. The unmodified raw body is verified before parsing or mutation; valid events land in `WebhookEvent` before normalization.
3. Canonical call identity is unique on account, provider, and provider call ID. Recording stays disabled; transcripts remain inside authenticated ResponseOS.
4. HubSpot execution requires both a token and `RESPONSEOS_LIVE_HUBSPOT_ENABLED=true`. Contact ambiguity requires human review. The export is limited to a contact, sanitized call activity, and qualified follow-up task; no deal, transcript, or recording URL is sent.
5. `CrmSyncOperation` is the durable retry/idempotency record. Provider object IDs are persisted independently so partial retries reconcile before creating another object.
6. Public audit requests use a dedicated `ProspectIntake`, a server-owned tenant, required idempotency key, audited operator transitions, and 90-day PII expiry for unqualified records. Public route exposure remains behind an explicit flag until a path-scoped WAF rule produces observed `429` evidence.
7. `/demo/live-call` renders its number server-side only behind an explicit visibility flag and carries automation, transcription, demo-context, and no-scheduling disclosures.
8. `CarrierProvider` remains mock-only because this slice does not control realtime audio. Outbound dialing, scheduling providers, recording, deal creation, production aliases, real client data, and unattended public availability remain excluded.

**Consequences.** Repository code can prove the bounded chain without claiming production readiness. A passing local or fixture test does not authorize live provider use; Gate Set A, exact-SHA hosted smoke, private call drills, rollback, duplicate-effect checks, and one outside-number rehearsal remain required before a human go/no-go can expose the number to a prospect.

---

## ADR-0048 — Personalized prospect bootstrap is a bounded, operator-approved demo knowledge slice

**Status:** Accepted (2026-08-20) for repository implementation. Extends ADR-0002, ADR-0029, ADR-0034, and ADR-0047. It authorizes only the website-derived, human-reviewed demo slice below; it does **not** generally advance v0.4 or authorize provider resources, credentials, deployment, phone-number purchase/routing, production import, or prospect exposure.

**Context.** A supervised prospect demonstration is materially stronger when the receptionist can answer from the prospect's own public website. The existing deterministic internal-demo fixture cannot safely serve that purpose, and the accepted v0.4 boundary prohibits silently introducing general tenant knowledge ingestion. The narrowest defensible exception needs provenance, tenant isolation, human approval, immutable context, bounded retention, and a lifecycle that cannot turn a demo account into production by accident.

**Decision.**

1. A personalized demo is a first-class `ProspectBootstrap` attached to a new `sandbox` `Account` with no prospect Clerk organization or login. AJ operators use existing server-derived roles; no client-supplied account identifier authorizes access.
2. Automatic acquisition is limited to the canonical public HTTPS page plus operator-approved same-origin URLs: at most 20 pages, two MiB per page, ten seconds per request, robots enforcement, redirect/DNS revalidation, validated-address connection pinning, private-range denial, and plain-text extraction. Discovered links are not followed automatically. Browser automation, authenticated/private pages, PDFs, uploads, social sources, scripts/forms, vector search, embeddings, RAG, and acquisition-time tools are excluded.
3. Acquired text is untrusted evidence, never a prompt. Schema-bounded facts retain URL, content hash, retrieval time, evidence excerpt, confidence, verification state, and conflicts. Operators may add a correction only when its evidence excerpt exactly occurs in one acquired source; it then enters the same unapproved review queue. Only `OPERATOR_APPROVED_FOR_DEMO` or `OWNER_CONFIRMED` facts compile into an immutable, checksummed `BusinessMemorySnapshot`. Snapshot facts retain bounded source URL/content hashes, evidence-excerpt hashes, confidence, and reviewer identity/time; raw excerpts do not enter assistant context. Unknowns and conflicts compile to refusal/fallback behavior.
4. One versioned receptionist policy serves all prospect demos. It is inbound-only, discloses automation and transcription, keeps recording off, and permits only verified-fact answers, qualification, callback capture, and hangup. It cannot schedule, collect payment, write CRM, transfer, dial outbound, give regulated advice, or make binding promises. Telnyx conversation memory is disabled.
5. A server-owned `TelephonyNumber` inventory and temporal `TelephonyNumberAssignment` ledger replace environment-only tenant routing for personalized demos. A number and bootstrap can each have at most one current assignment. Signed initialization and post-call events resolve the called target plus event time against assignment history; unresolved events never inherit another tenant.
6. Number registration and activation require a fresh Ed25519-signed provider-readback attestation bound to the number, assistant, template, initialization webhook, recording-off, memory-off, and hangup-only posture; the signing key remains in the protected provider workflow. Activation also requires a current approved snapshot, assigned number, enabled profile, policy checksum, explicit feature flag, and operator action. Draft through pre-activation failure states use a renewable seven-day review TTL; ready and active lifetimes are each bounded to 14 days. Expiry always starts the cleanup clock. Content and personalized transcripts expire after 30 days; raw webhook bodies are scrubbed on the same schedule. Number reuse requires a 14-day sliding quarantine, zero unresolved activity, and operator approval. Provider release remains a separate destructive gate.
7. Promotion exports an immutable allowlisted manifest containing approved business configuration, provenance metadata, snapshot hash, and template/policy versions. It excludes credentials, raw webhook bodies, callers, transcripts, recordings, CRM operations, demo audit history, and every unapproved/conflicted/expired fact. A production import must create a new disabled customer tenant and remains behind its own production authorization; it never reuses the sandbox account ID or database. The sandbox is marked converted only after a separate operator acknowledgment matches the exported manifest hash and records the imported account reference.
8. CRM synchronization is disabled for personalized prospect accounts. The existing bounded HubSpot test adapter remains available only to the generic ADR-0047 evidence chain and cannot be triggered by a personalized bootstrap call.

**Consequences.** ResponseOS may implement and test a provenance-backed personalized demo without becoming a crawler, document platform, or generic knowledge product. The new schema and operator surfaces are real repository capability, but live usefulness remains gated on existing mock/live-demo readiness, exact-SHA deployment evidence, Telnyx configuration, controlled number inventory, private rehearsal, and human go/no-go. The general v0.4 gates continue to govern client uploads, production tenant grounding, retrieval infrastructure, and all broader knowledge sources.

---

## ADR-0049 — Environment promotion is contract-driven, identity-isolated, secret-free, and independently certified

**Status:** Accepted (2026-08-22) for repository governance, schema, tooling, documentation, and tests. **No external resource mutation, secret installation, workflow dispatch, deployment, alias/domain change, provider activation, phone routing, prospect exposure, customer activation, or Production promotion is authorized by this ADR.**

**Context.** ResponseOS has a configuration-certified governed staging environment, but a successful staging configuration is not a safe instruction to recreate Production manually. Configuration semantics, environment resource identity, secret metadata, secret values, and certification evidence have different lifecycles. Copying staging values would couple environments; recording values in Git would disclose credentials; relying on operator memory would make promotion unauditable and non-repeatable for future clients.

**Decision.**

1. **ResponseOS Environment Contract v1 is the canonical environment-governance format.** Its schema identifier is `responseos.environment.v1`; companion v1 schemas govern secret metadata, certification records, and promotion policy.
2. **The promotion sequence is fixed:** certified configuration contract → Production promotion plan → provision new resources → install environment-specific secrets → readback → diff → certify → human approval → deploy. Every arrow is a separate gate.
3. **Five concerns remain separate:** configuration semantics; environment-specific resource identity; secret metadata; secret values; certification evidence. Secret values never enter Git, canonical hashes, diffs, plans, logs, or certification records.
4. **Every governed configuration leaf has exactly one promotion classification:** `MUST_MATCH`, `MUST_DIFFER`, or `HUMAN_APPROVAL_REQUIRED`. Duplicate path classifications or unclassified staging fields fail validation.
5. **Production identities are independently provisioned.** At minimum Vercel project/custom-environment identity, Neon project/branch/endpoint identity, Clerk Production instance and keys, database credentials, webhook secrets, provider credentials, provider encryption keys, domain, phone numbers, and signing/private keys may not be copied from staging.
6. **Canonical fingerprints use deterministic JSON plus SHA-256.** Object keys are recursively sorted; array order remains meaningful; formatting and whitespace are ignored. The environment-contract fingerprint hashes `environment.json`; the configuration fingerprint hashes the environment plus secret metadata only. This is configuration-governance hashing, not the event-ledger proof layer deferred by ADR-0044.
7. **Certification is configuration-only unless a separate record explicitly and truthfully certifies another scope.** The current staging record binds `Verify Staging Configuration` run `32586167278`, workflow-control SHA `6202da68cb9b517b39814bab5b1542fd65adae22`, and intended application SHA `4a5b29b83cb3f18137b0151ae6242b2ac484ef08`; it does not claim a deployment occurred.
8. **Tooling is read-only/planning-only in v1.** Capture accepts repository-controlled JSON/readback fixtures; validation, diff, hashing, and plan generation make no provider/API calls and mutate no external system. Live readback and scheduled drift polling require a separate reviewed change.
9. **Production fails closed.** Missing required identities, reused staging resources, test/development authentication posture, unauthorized provider activation, unknown schema versions, malformed contracts, or likely credential material block certification. Human-approval results remain visible and never become implicit approvals.
10. **Prospect promotion stays separate.** `prospect-promotion.v1` governs reviewed business/customer state. Environment promotion governs infrastructure/runtime configuration. A future client instance requires both a certified Production environment and an approved client promotion manifest, plus separate activation authority.

**Consequences.** Production and future client environments can be planned, read back, diffed, fingerprinted, and certified without copying secret values or treating staging resource identity as portable. The cost is deliberate operational ceremony and additional metadata maintenance. Green schema/tooling tests prove repository contract behavior only; they do not prove Production readiness, provider readiness, deployment success, customer activation, or legal/commercial approval. The Production resource/secret/deploy gates in ADR-0019, ADR-0039, ADR-0047, readiness Gate Set B, and the operator governance contract remain intact.

---

## ADR-0050 — CRM interoperability uses canonical models, governed mutation intents, and provider adapters

**Status:** Proposed (2026-08-23), pending exact-head operator review and squash-merge authorization. If accepted, this ADR is architecture doctrine only. **CRM-0 authorizes no runtime implementation, schema or migration change, provider activation, credential configuration, external API call, deployment, or production mutation. CRM-1 and every later phase remain separately gated.**

**Relationship to existing decisions.** This ADR extends ADR-0001 (mock-first provider boundaries), ADR-0002 (event-ledger-first internal truth), ADR-0009 (signature validation before business mutation), ADR-0027 (client-owned and pluggable external CRM), ADR-0033 (HubSpot as the client-overridable default external commercial system of record), ADR-0043 (portability requires evidence), and ADR-0047 (the bounded supervised post-call evidence chain). It does not supersede their deployment, provider, claims, or evidence gates. In particular, HubSpot may remain the default external commercial CRM for an authorized deployment without becoming the schema or business-logic center of ResponseOS.

### 1. Decision

ResponseOS SHALL use a provider-independent canonical relationship and operational model.

External CRMs SHALL integrate through adapters and governed synchronization contracts.

Core ResponseOS business logic SHALL NOT depend directly on one CRM's native schema.

This decision preserves the platform boundary in ADR-0040 and platform doctrine §5: ResponseOS is not a general-purpose CRM. It owns the canonical events, operational evidence, business memory, policy, orchestration, attribution, and audit required for its revenue-recovery workflows; external CRMs continue to own the downstream commercial or service records their teams operate against.

### 2. Current state

The labels in this section are implementation claims verified against the repository at CRM-0 authoring time. The target sections that follow are doctrine, not descriptions of running behavior.

#### Implemented today

- `Account`, `Contact`, `Call`, `LeadEvent`, `LeadQualification`, `Appointment`, and `QuoteRequest` provide the beginning of an account-scoped, provider-independent relationship and operational substrate. They do **not** constitute a complete CRM.
- `CrmSyncOperation` and `CrmSyncOperationStatus` provide a durable, call-centric synchronization record with `pending`, `processing`, `succeeded`, `retryable_failed`, `review_required`, and `cancelled` states.
- The existing operation record carries retry, review, and idempotency-oriented primitives including unique `operation_key`, `attempt_count`, `next_attempt_at`, `last_error_code`, `last_error_redacted`, and separately persisted provider contact/activity/task identifiers.
- `runCrmSyncForCall` implements a narrow finalized-call orchestration seam: account-scoped canonical record lookup, phone normalization, contact ambiguity review, sanitized call-activity creation, qualified follow-up task creation, partial-write recovery, operator retry, and a deterministic operation key.
- `CrmProviderId` is exactly `"mock" | "hubspot"`. The current `CrmProvider` contract is narrow and call-centric; it is not the target generic adapter contract in §17.
- `MockCrmProvider` is the deterministic default path.
- `HubSpotCrmProvider` contains source-proven HTTP operations for contact search/create, call and task search/create, and contact associations. Selection requires both `RESPONSEOS_LIVE_HUBSPOT_ENABLED=true` and a token; otherwise the factory returns mock.
- Integration tests prove durable operation idempotency and ambiguity-to-review behavior against a mock provider. Unit tests prove token presence alone does not activate HubSpot.

The bounded HubSpot code is therefore `PARTIALLY_SHIPPED`: a real, explicitly gated adapter seam exists, but the repository does not establish production activation, generalized entity/field synchronization, inbound HubSpot reconciliation, multiple connections, autonomous mutation authority, or production-verified interoperability. ADR-0047's test-account, supervised-demo, and separate-operator-gate limitations remain in force.

#### Not implemented today — `TARGET / NOT YET IMPLEMENTED`

- generalized `CrmConnection`
- generic `CrmEntityMapping`
- generic `CrmFieldMapping`
- `CrmMutationIntent`
- field-level authority and conflict evaluation
- `CrmConflict`
- generic inbound `CrmSyncCursor`
- provider capability negotiation or a generalized provider registry
- generalized multi-entity or multi-CRM synchronization operations
- Salesforce adapter
- GoHighLevel adapter
- Zoho adapter
- Twenty adapter
- Pipedrive or vertical-CRM adapters
- autonomous agent CRM writes
- generic inbound CRM webhook application to canonical entities
- multi-connection or multi-CRM account behavior

No planned entity, contract, adapter, or phase below may be cited as existing implementation merely because this ADR is present or accepted.

### 3. Target architecture — `TARGET / NOT YET IMPLEMENTED`

```text
External Events
    ↓
ResponseOS Event Ledger
    ↓
Canonical Domain Model
    ↓
Mutation Intent
    ↓
Authority + Policy
    ↓
CRM Orchestration
    ↓
Provider Adapter
    ↓
External CRM
    ↓
Readback / Reconciliation
    ↓
Audit Evidence
```

The event ledger preserves what happened. Canonical domain records provide provider-independent working state. Mutation intents express proposed effects. Authority and policy decide whether those effects may proceed. Adapters translate approved canonical operations into provider semantics. Readback and reconciliation determine whether the requested effect exists and what authority it deserves.

### 4. Systems of record

#### Operational record — “What happened?”

The ResponseOS event ledger is the internal operational source of truth under ADR-0002. External events land there before downstream business mutation, with stable dedupe identity, tenant context, signature evidence where applicable, timestamps, and provenance.

#### Business Memory — “What does ResponseOS know, why, and with what authority?”

Business Memory is the evidence-linked, tenant-isolated interpretation derived from operational events and approved sources. A fact must retain its source, verification state, authority, time, and correction history. The existence of a CRM value does not automatically make that value authoritative business truth.

#### External CRM — “What commercial or service state should downstream teams operate against?”

An external CRM is a client-owned downstream operating system. ADR-0033 currently selects HubSpot as the client-overridable default external commercial system of record for the authorized communications direction. That deployment default does not make HubSpot the ResponseOS internal ledger, canonical identifier authority, or business-logic schema.

Authority SHALL be configurable by field or domain. ResponseOS explicitly prohibits global last-write-wins synchronization.

### 5. Canonical model

#### Current canonical substrate — implemented

`Account`, `Contact`, `Call`, `LeadEvent`, `LeadQualification`, `Appointment`, and `QuoteRequest` are current source-proven models. Together they establish the beginning of the canonical relationship and operational substrate. Provider identifiers are attributes or mapping evidence at integration boundaries; they are not the identity of the canonical object.

#### Potential future additions — `TARGET / NOT YET IMPLEMENTED`

- `Opportunity` — provider-independent commercial opportunity state and evidence references
- `Interaction` — normalized relationship interaction across channels
- `Task` — canonical follow-up intent and lifecycle, distinct from any provider task ID
- `RelationshipState` — evidence-linked relationship status and authority metadata

CRM-0 adds none of these to Prisma. Each requires a separately approved problem statement, schema design, tenant-isolation analysis, migration plan, tests, and claims review.

### 6. Future CRM infrastructure models — `TARGET / NOT YET IMPLEMENTED`

| Conceptual model | Target responsibility |
|---|---|
| `CrmConnection` | Tenant-owned provider connection identity, state, mode, capabilities, and external secret reference |
| `CrmEntityMapping` | Durable canonical-entity ↔ provider-entity identity mapping |
| `CrmFieldMapping` | Versioned direction, transform, authority, null, conflict, and sensitivity rules |
| `CrmMutationIntent` | Auditable proposed canonical mutation before provider translation or execution |
| `CrmConflict` | Competing values, authority evidence, resolution state, and disposition |
| `CrmSyncCursor` | Provider/account-scoped incremental change position and reconciliation evidence |

These names define conceptual contracts only. They are not Prisma models, migrations, API resources, or runtime services in CRM-0.

### 7. `CrmConnection` — `TARGET / NOT YET IMPLEMENTED`

A future `CrmConnection` is responsible for:

- provider identifier
- owning ResponseOS `accountId`
- provider account or portal identity
- connection state
- permitted sync mode
- advertised and verified capabilities
- external secret reference, never a portable credential value
- created, verified, and last-health-check timestamps

One ResponseOS account may eventually support multiple CRM connections. That possibility does not authorize multi-connection behavior now. Credentials remain outside the canonical model, audit evidence, exported client packages, and repository.

### 8. Provider capabilities — `TARGET / NOT YET IMPLEMENTED`

Future adapters SHALL advertise capabilities and orchestration SHALL check them before planning or executing an operation. Capability names may include:

```text
contacts.read
contacts.write
accounts.read
accounts.write
opportunities.read
opportunities.write
activities.append
tasks.write
appointments.read
appointments.write
webhooks.receive
incremental_sync
custom_fields.read
custom_fields.write
```

Capabilities are connection-specific evidence, not assumptions derived only from a provider name. An unsupported, unverified, or revoked capability SHALL fail explicitly. It SHALL NOT silently no-op, downgrade to a different mutation, or be inferred from an available credential.

### 9. Entity mapping — `TARGET / NOT YET IMPLEMENTED`

Entity mapping relates a canonical entity to a provider entity:

```text
canonical entity ↔ provider entity
```

Provider-native IDs SHALL NOT become ResponseOS canonical IDs. Identity mappings must be explicit, durable, account-scoped, connection-scoped, and auditable. Mapping evidence should support provider merges, replacements, deleted objects, and historical reconciliation without changing the canonical identity.

If identity resolution produces more than one plausible match, the result is `REVIEW_REQUIRED`. The existing ambiguous-contact behavior in `runCrmSyncForCall` is the current narrow precedent.

### 10. Field mapping — `TARGET / NOT YET IMPLEMENTED`

A versioned future field mapping supports:

- canonical field
- provider field
- direction
- transform
- authority
- null behavior
- conflict behavior
- sensitivity

Allowed directions are:

```text
OUTBOUND
INBOUND
BIDIRECTIONAL
NONE
```

Transforms must be deterministic and version-addressable. Sensitivity rules govern what may be transmitted or retained. Null behavior must distinguish “unknown,” “not applicable,” “explicitly cleared,” and “provider omitted” where the canonical domain requires that distinction.

### 11. Mutation intent — `TARGET / NOT YET IMPLEMENTED`

Agents SHALL NOT directly issue arbitrary provider mutations. Humans and workflows should also use the same governed path for consequential writes.

```text
Agent / Human / Workflow
    ↓
CrmMutationIntent
    ↓
Canonical validation
    ↓
Authority validation
    ↓
Policy validation
    ↓
Conflict detection
    ↓
Approval
    ↓
Adapter translation
    ↓
Execution
    ↓
Readback
    ↓
Audit
```

A mutation intent describes the canonical entity, proposed change, reason, evidence, actor, execution class, expected current state, idempotency key, required capability, approval state, and correlation identity. It is a proposal until the applicable authority, policy, and approval gates clear.

### 12. Agentic execution classes — `TARGET / NOT YET IMPLEMENTED`

| Class | Meaning | Conceptual control posture |
|---|---|---|
| `A0 OBSERVE_ONLY` | Read, compare, explain, or propose without external mutation | Read authorization, tenant scope, and audit of consequential access |
| `A1 LOW_RISK_APPEND` | Append bounded, non-authoritative activity or follow-up evidence | Allowlisted fields, idempotency, policy check, readback, audit |
| `A2 CONTROLLED_RECORD_UPDATE` | Update a reversible relationship or operational field | Field authority, expected version, conflict check, stronger approval policy |
| `A3 COMMERCIAL_STATE_MUTATION` | Change opportunity, stage, appointment, ownership, or another commercial workflow state | Verified evidence, explicit authority, human approval by default, reconciliation |
| `A4 SENSITIVE_OR_IRREVERSIBLE` | Delete, merge, bulk-rewrite, transmit sensitive data, or perform a difficult-to-reverse action | Explicit human authorization, dry-run or preview where possible, rollback plan, enhanced audit |

Higher-risk classes require progressively stronger identity, authority, evidence, approval, and verification. Agent inference alone cannot silently establish authoritative commercial facts. Classification does not grant permission; it determines the minimum controls an independently authorized implementation must enforce.

### 13. Conflict resolution — `TARGET / NOT YET IMPLEMENTED`

Global last-write-wins is prohibited. Conflict evaluation considers, at minimum:

- field/domain authority
- verification state
- source provenance
- event time and receive time
- provider version, revision, or ETag where available
- explicit field ownership
- expected prior value
- human approval or correction history

Potential outcomes are:

```text
AUTO_ACCEPT_CANONICAL
AUTO_ACCEPT_EXTERNAL
MERGE
KEEP_BOTH
REVIEW_REQUIRED
REJECT_EXTERNAL
```

Automatic outcomes are allowed only when deterministic policy and sufficient evidence establish them. Missing policy or ambiguous authority returns `REVIEW_REQUIRED`.

### 14. Outbound synchronization — `TARGET / NOT YET IMPLEMENTED`

```text
Canonical Event/Entity
    ↓
Mutation Intent
    ↓
Entity Mapping
    ↓
Field Mapping
    ↓
Provider Adapter
    ↓
External Write
    ↓
Provider Readback
    ↓
Verified Success
    ↓
Audit
```

An HTTP success response proves only that the provider accepted or processed a request according to its API contract. It does not necessarily prove the intended final state, durable synchronization, or authoritative business truth. The orchestration policy decides what readback or later reconciliation is required before marking synchronization verified.

### 15. Inbound synchronization — `TARGET / NOT YET IMPLEMENTED`

External CRM webhooks SHALL NOT directly mutate canonical entities.

```text
Webhook / Incremental Change
    ↓
Integration Event
    ↓
Normalization
    ↓
Entity Resolution
    ↓
Authority / Conflict Evaluation
    ↓
Canonical Mutation Proposal
    ↓
Apply or Review
    ↓
Audit
```

ADR-0009 remains mandatory: signature validation occurs before parsing and before any business mutation. Valid signature evidence establishes message authenticity under the provider's mechanism; it does not establish entity identity, field authority, or permission to overwrite canonical state.

### 16. Idempotency

Duplicate webhook delivery, provider retry, workflow rerun, operator retry, or agent rerun SHALL NOT silently duplicate provider activities or canonical effects.

The implemented unique `CrmSyncOperation.operation_key` and separately persisted provider object identifiers are current precedent. Future mutation intents and generic sync operations extend that doctrine with account, connection, canonical entity, operation kind, target version, and correlation context as required. Idempotency prevents duplicate effect; it does not convert an unauthorized or conflicted mutation into an authorized one.

### 17. Adapter contract — conceptual target, not the current interface

Future adapter operations may include:

```text
capabilities()
health()
findEntities()
getEntity()
createEntity()
updateEntity()
appendActivity()
createTask()
associateEntities()
listChanges()
verifyMutation()
```

The adapter owns:

- provider HTTP/API semantics
- authentication mechanics and secret resolution
- provider identifiers
- pagination and incremental-provider mechanics
- rate limiting and retry signals
- provider-specific transforms
- provider-specific errors and redaction

The adapter SHALL NOT own:

- canonical business meaning
- field or domain authority policy
- approval policy
- agent permissions
- tenant identity derived from client input
- whether provider success becomes authoritative truth

The current `CrmProvider` interface remains a narrow implemented seam and is not evidence that this target contract exists.

### 18. Provider registry — `TARGET / NOT YET IMPLEMENTED`

```text
Provider Registry
    ├── mock         CURRENT: deterministic implemented adapter
    ├── hubspot      CURRENT: bounded, call-centric, explicitly gated adapter seam
    ├── salesforce   FUTURE: not implemented
    ├── ghl          FUTURE: not implemented
    ├── zoho         FUTURE: not implemented
    └── twenty       FUTURE: not implemented
```

The registry itself is future. The tree records the intended provider slots and the source-proven status of the two current provider IDs; it does not advertise support for the future providers.

Second-provider support is an architectural test:

> If adding another CRM requires rewriting ResponseOS business logic, the abstraction has failed.

ADR-0043 still governs portability claims. One mock plus one bounded adapter does not establish generalized or production-proven provider independence.

### 19. Standalone mode

ResponseOS SHALL remain functional with zero connected external CRMs. Standalone operation supports:

- demonstrations
- bootstrap clients
- CRM-less clients
- degraded-provider operation
- migration periods

External CRM integration enhances ResponseOS; it does not define whether ResponseOS can boot, preserve its canonical evidence, or run authorized provider-free workflows. This extends ADR-0001's zero-credential/mock-first rule.

### 20. Multi-CRM mode — `TARGET / NOT YET IMPLEMENTED`

Future design may support:

```text
ResponseOS
    ├── HubSpot
    ├── ServiceTitan
    ├── Salesforce
    └── other systems
```

Authority must be field- or domain-specific. Multiple connections do not imply that every system may author every field. CRM-0 authorizes no multi-CRM runtime, schema, connection, routing, or provider behavior.

### 21. Audit and provenance — `TARGET / NOT YET IMPLEMENTED` for the generalized mutation chain

Every future external mutation must be attributable to:

- ResponseOS account
- canonical entity
- external connection
- mutation intent
- human, agent, or workflow actor
- agent/workflow identity and version where applicable
- supporting evidence
- required and received approval
- synchronization operation
- provider result
- readback or reconciliation evidence
- conflict result
- correlation ID

Provider credentials, authorization headers, refresh tokens, private keys, and other secrets are never persisted in audit evidence. Existing `CrmSyncOperation`, `AuditLog`, and `WebhookEvent` records are precedents, not the complete target provenance model.

### 22. Agent tool doctrine — `TARGET / NOT YET IMPLEMENTED`

Future agent tools should express canonical intent:

```text
crm.lookup_contact
crm.propose_contact_update
crm.append_interaction
crm.propose_opportunity
crm.propose_stage_change
crm.create_followup
```

Core agents should not be exposed directly to concrete provider mutations such as:

```text
hubspot.patch_contact
salesforce.update_lead
ghl.create_opportunity
```

Concrete provider calls belong behind orchestration, capability checks, mapping, policy, approval, and audit. A canonical tool name does not itself authorize a mutation.

### 23. Failure doctrine

If ResponseOS cannot establish:

- entity identity
- field mapping
- sufficient authority
- provider capability
- safe mutation policy
- idempotency
- conflict resolution

then it SHALL:

```text
DO NOT WRITE
REVIEW_REQUIRED
```

Failure to prove safety is not permission to guess, skip a layer, or write directly through a provider SDK.

### 24. Gated implementation roadmap

| Phase | Status | Locked scope and gate |
|---|---|---|
| **CRM-0 — Doctrine** | **NOW — documentation only** | This ADR, roadmap alignment, and changelog only. No runtime or external mutation. |
| **CRM-1 — Connection + Registry** | **FUTURE / GATED** | Introduce generalized `CrmConnection` and Provider Registry; wrap existing provider seams. Requires a separate approved PRD/ADR and implementation authorization. |
| **CRM-2 — Entity Mapping + Generic Operations** | **FUTURE / GATED** | Introduce `CrmEntityMapping`; generalize `CrmSyncOperation` beyond its existing call-centric shape. |
| **CRM-3 — Field Mapping + Inbound Sync** | **FUTURE / GATED** | Introduce `CrmFieldMapping`, `CrmSyncCursor`, and `CrmConflict`; define signed inbound reconciliation. |
| **CRM-4 — Agentic Mutation Governance** | **FUTURE / GATED** | Introduce `CrmMutationIntent`, authority evaluation, execution classes, and approval gates. |
| **CRM-5 — Second Real CRM Adapter** | **FUTURE / GATED** | Prove provider independence with a separately selected second provider. Twenty and GoHighLevel are candidates only; selection requires a separate decision. |
| **CRM-6 — Broader Adapter Ecosystem** | **FUTURE / GATED** | Add Salesforce, Zoho, Pipedrive, or vertical CRMs only when justified by validated market need. |

Phases are dependency-ordered. Acceptance of CRM-0 does not start, authorize, schedule, or pre-approve CRM-1. Each phase requires current-state verification, its own minimum PRD/task spec, doctrine §21 review, security and tenant-isolation analysis, explicit operator authorization, and the repository's validation/PR gates.

### 25. Live-demo non-interference rule

CRM-0 does **not** expand the current live-demo scope.

CRM-1 or later MUST NOT begin merely because this ADR merges. Current staging and live-demo gates remain higher-priority. This ADR authorizes no external CRM activation, live HubSpot write, provider credential configuration, HubSpot configuration change, workflow dispatch, staging mutation, Vercel/Neon/Clerk/Telnyx/Vapi/Twilio action, deployment, or production action.

ADR-0047's bounded post-call code path and separate operator gates remain exactly as they are. CRM-0 neither invokes that path nor expands it.

### 26. Acceptance invariants

1. Core ResponseOS functionality must work without HubSpot.
2. Provider-native IDs never become canonical IDs.
3. Core business workflows do not import concrete CRM SDKs.
4. Agents do not bypass the mutation-intent and policy layer once that layer is implemented; before then, no autonomous provider writes are authorized.
5. External webhooks do not directly mutate canonical entities.
6. Ambiguous identity resolution fails to `REVIEW_REQUIRED`.
7. External provider success does not automatically establish authoritative business truth.
8. Higher-authority canonical evidence cannot be silently overwritten by lower-authority data.
9. Provider capability gaps fail explicitly.
10. Every external mutation is auditable.
11. Secrets remain outside portable client packages and audit evidence.
12. Adding a second CRM adapter must not require rewriting canonical ResponseOS business logic.
13. ResponseOS remains usable with zero CRM connections.
14. This ADR itself authorizes no runtime or provider mutation.

### 27. Architecture review against platform doctrine §21

1. **Layer:** canonical CRM interoperability spans Communications Capture, Business Memory, Operational Models, and Trust Infrastructure; CRM-0 changes documentation only.
2. **Build, integrate, or defer:** build canonical identity, evidence, policy, mapping, and orchestration; integrate commodity CRMs through adapters; defer runtime to CRM-1+.
3. **Live pilot path:** the doctrine prevents a future CRM seam from corrupting the pilot path; it does not expand or activate that path.
4. **Evidence:** ledger-first ingest, mutation intents, readback, reconciliation, and audit preserve evidence.
5. **Verified outcomes:** provider acceptance is explicitly separated from verified and authoritative outcomes.
6. **Proprietary learning:** canonical operational history can support learning after verified outcomes exist; no moat is claimed now.
7. **Commodity purchase:** external CRM storage and APIs are bought/integrated, not rebuilt.
8. **Duplication risk:** ResponseOS remains not-a-general-CRM and implements only the canonical operating layer required by its workflows.
9. **Lock-in:** provider IDs stay outside canonical identity; mappings and adapters contain provider semantics.
10. **Tenant isolation:** every future connection, mapping, intent, cursor, conflict, and operation is account-scoped from server-derived authority.
11. **Attribution ambiguity:** authority, conflict, and readback rules reduce ambiguity; unresolved cases require review.
12. **Claims:** every future contract and provider is labeled `TARGET / NOT YET IMPLEMENTED`; portability remains unproven under ADR-0043.
13. **Human approval:** A3 and A4 require progressively stronger approval, with human approval the default for commercial, sensitive, or irreversible effects.
14. **Compliance exposure:** sensitivity metadata, secret exclusion, audit, and do-not-write failure behavior constrain exposure; no compliance claim is created.
15. **Required now or interesting:** CRM-0 is required now to prevent planned adapters and entities from being mistaken for implementation. CRM-1+ is strategically relevant but separately gated.

### 28. Canonical language

**Internal architecture doctrine only — not a current-capability or market-facing claim.** The exact statement below must retain the adjacent status caveat until ADR-0043's portability evidence standard is satisfied.

> ResponseOS is not a HubSpot integration.
>
> ResponseOS is the provider-independent relationship, operational, memory, and intelligence layer from which external CRM systems can be synchronized through governed adapters.

This language states accepted architecture intent. Generalized provider interoperability is not currently implemented or proven, and the sentence remains prohibited in public copy, demos, comments, or commit messages as a present capability claim.
