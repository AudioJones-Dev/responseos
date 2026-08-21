# Data Schema

The schema mirrors `types/*.ts` and `prisma/schema.prisma`. Conventions:

- snake_case columns to match API/JSON shapes already used by the app.
- Tenant isolation: every per-tenant table carries `account_id`.
- Money is stored in **cents** (Int).
- JSON fields use Postgres `jsonb` so config payloads stay flexible.
- IDs are `cuid()` strings; timestamps are ISO 8601.

## Current implementation snapshot

The source of truth for exact fields, enum values, relations, and indexes is `prisma/schema.prisma`. The current migration chain runs from `0001_v0_2_foundation` through `0010_v0_3_provider_enum_alignment`.

Current Prisma models:

| Model | Purpose |
|---|---|
| `Account` | Tenant root, formerly `Organization`. |
| `User` | AJ/operator/client user with Clerk identity columns and role. |
| `Contact` | Customer/prospect record per account. |
| `Call` | Logical phone interaction. |
| `LeadEvent` | Captured demand signal and recovery event. |
| `LeadQualification` | Qualification snapshot for a lead event. |
| `Appointment` | Booking/job visit, formerly `Booking`. |
| `QuoteRequest` | Quote/estimate request header. |
| `Automation` | Workflow definition. |
| `Notification` | Outbound dispatch record. |
| `RevenueMetrics` | KPI facts per period per account. |
| `AssessmentReport` | Readiness / revenue-leak assessment artifact. |
| `Engagement` | Commercial engagement state and terms. |
| `AuditLog` | Admin/system audit event. |
| `WebhookEvent` | Vendor webhook ingest record with signature/dedupe fields. |
| `ProviderConnection` | Per-account provider connection metadata. |
| `Conversation` | SMS / messaging thread root. |
| `SmsMessage` | Per-message row under a conversation. |
| `CallSegment` | Turn-level call transcript segment. |
| `CallTranscript` | Full transcript artifact and retention lane. |
| `QaLog` | QA review / scoring record. |
| `WorkflowRun` | n8n/internal workflow execution log. |

Current migration history:

| Migration | Effect |
|---|---|
| `0001_v0_2_foundation` | Initial v0.2 Postgres foundation. |
| `0002_organization_to_account_rename` | Renames tenant root from organization to account. |
| `0003_booking_to_appointment_rename` | Renames bookings to appointments. |
| `0004_communication_substrate` | Adds provider connections, conversations, and SMS messages. |
| `0005_call_intelligence_substrate` | Adds call segments, transcripts, and QA logs. |
| `0006_workflow_run_substrate` | Adds workflow run tracking. |
| `0007_audit_logs_expansion` | Expands audit logging. |
| `0008_clerk_identity_columns` | Adds Clerk identity wiring columns. |
| `0009_internal_demo_professional_receptionist` | Adds internal-demo account classification and professional receptionist substrate. |
| `0010_v0_3_provider_enum_alignment` | Adds Telnyx carrier/SMS/connection and Calendly scheduling/connection enum values only; no live provider behavior. |

The sections below retain historical v0.1/v0.2 design context. If they conflict with `prisma/schema.prisma`, the Prisma schema wins until this document is fully rewritten from the live schema.

## Historical v0.1 base models (11)

The v0.1 model is intentionally narrow. It captures the core revenue-recovery shape without committing to deep CRM emulation.

### organizations
Historical tenant root. Implemented schema now uses `accounts` / `Account`.

| field | type | notes |
|---|---|---|
| id | string | PK, cuid |
| name | string | display name |
| slug | string | unique URL slug |
| industry | string | e.g. `home-services` |
| website_url | string? | optional |
| primary_phone | string? | E.164 |
| timezone | string | IANA, e.g. `America/New_York` |
| status | enum | `lead` \| `active` \| `paused` \| `cancelled` |
| created_at, updated_at | timestamp | |

### users
Operator + tenant users.

| field | type | notes |
|---|---|---|
| id | string | PK |
| account_id | string? | nullable for AJ-internal staff |
| role | enum | `aj_admin` \| `operator` \| `client_admin` \| `client_viewer` |
| name, email, phone | strings | email unique |
| created_at, updated_at | timestamp | |

### contacts
Customer/prospect record per workspace.

| field | type | notes |
|---|---|---|
| id, account_id | string | tenant-scoped |
| first_name, last_name, phone, email | optional | |
| address, city, state, zip | optional | |
| source | enum | `call` \| `sms` \| `form` \| `manual` \| `crm_sync` |
| created_at, updated_at | timestamp | |

### calls
One logical phone interaction.

| field | type | notes |
|---|---|---|
| id, account_id | string | |
| contact_id | string? | nullable for spam/anonymous |
| provider | enum | `twilio` \| `retell` \| `vapi` \| `bland` \| `manual` |
| provider_call_id | string? | external id |
| direction | enum | `inbound` \| `outbound` |
| status | enum | `answered` \| `missed` \| `voicemail` \| `spam` \| `failed` \| `completed` |
| from_number, to_number | string | E.164 |
| started_at, ended_at | timestamp | |
| duration_seconds | int? | |
| recording_url, transcript, summary | string? | |
| sentiment | enum? | `positive` \| `neutral` \| `negative` |
| spam_score | float? | 0..1 |
| lead_score | int? | 0..100 |

### lead_events
**Central revenue-recovery object.** Every captured demand signal becomes a lead_event.

| field | type | notes |
|---|---|---|
| id, account_id | string | |
| contact_id, call_id | string? | optional links |
| source | enum | `phone` \| `sms` \| `website` \| `manual` \| `outbound` |
| event_type | enum | `missed_call` \| `answered_call` \| `quote_request` \| `booking_request` \| `qualified_lead` \| `spam` \| `follow_up_needed` \| `appointment_booked` \| `quote_sent` \| `job_won` \| `job_lost` |
| status | enum | `new` \| `qualified` \| `unqualified` \| `booked` \| `quoted` \| `won` \| `lost` \| `archived` |
| urgency | enum | `low` \| `medium` \| `high` |
| estimated_value, recovered_value | int? (cents) | |
| notes | string? | |

### lead_qualification
**Linked to `lead_event_id`, not `contact_id`.** A qualification snapshot at a moment in time.

| field | type | notes |
|---|---|---|
| id | string | |
| lead_event_id | string | unique FK |
| service_needed | string? | |
| service_area_match | bool | |
| budget_range | string? | |
| timeline | enum? | `same_day` \| `this_week` \| `this_month` \| `unknown` |
| property_type | string? | |
| decision_maker | bool? | |
| qualification_score | int | 0..100 |
| qualification_status | enum | `qualified` \| `maybe` \| `unqualified` \| `spam` |
| disqualification_reason | string? | |

### bookings
Historical appointment / job visit name. Implemented schema now uses `appointments` / `Appointment`.

| field | type | notes |
|---|---|---|
| id, account_id, contact_id | string | |
| lead_event_id | string? | |
| calendar_provider | enum | `google` \| `calcom` \| `ghl` \| `manual` |
| external_event_id | string? | |
| title | string | |
| start_time, end_time | timestamp | |
| status | enum | `scheduled` \| `confirmed` \| `completed` \| `cancelled` \| `no_show` |
| location, notes | string? | |

### quote_requests
Quote/estimate header.

| field | type | notes |
|---|---|---|
| id, account_id, contact_id | string | |
| lead_event_id | string? | |
| service_type | string | |
| description | string? | |
| photos | string[] | URLs |
| property_address | string? | |
| estimated_value | int? (cents) | |
| status | enum | `requested` \| `reviewing` \| `sent` \| `accepted` \| `declined` |

### automations
Trigger-driven workflow definitions.

| field | type | notes |
|---|---|---|
| id, account_id | string | |
| name | string | |
| trigger_type | enum | `missed_call` \| `after_hours_call` \| `new_lead` \| `quote_requested` \| `booking_created` \| `no_response` \| `job_completed` |
| status | enum | `active` \| `paused` \| `draft` |
| workflow_provider | enum | `n8n` \| `make` \| `internal` |
| webhook_url | string? | |
| config_json | jsonb | |

### notifications
Outbound dispatch record.

| field | type | notes |
|---|---|---|
| id, account_id | string | |
| lead_event_id | string? | |
| channel | enum | `sms` \| `email` \| `in_app` \| `slack` |
| recipient | string | |
| subject, message | strings | |
| status | enum | `queued` \| `sent` \| `failed` |
| sent_at | timestamp? | |

### revenue_metrics
Aggregated KPI facts per period per workspace.

| field | type | notes |
|---|---|---|
| id, account_id | string | |
| period_start, period_end | timestamp | unique together with org |
| total_calls, missed_calls, calls_answered_by_ai | int | |
| qualified_leads, appointments_booked, quotes_requested, quotes_sent, jobs_won | int | |
| estimated_recovered_revenue, verified_recovered_revenue | int (cents) | |
| admin_hours_saved | int | |
| response_time_avg_seconds | int | |
| roi_multiple | float? | |

## Modeling rules (apply to all tables, current and future)

- Every mutable business table carries `account_id`, `created_at`, `updated_at`, and (where applicable) `external_ids`/`source_system` references.
- Every provider callback should land first in the immutable event ledger (v0.2) with a durable dedupe key.
- Every user-visible metric is computed from normalized facts, not directly from provider payloads.

---

## v0.2 expansion status

The deep research report defined an event-ledger-first canonical model. v0.2 has now shipped part of that expansion through Prisma migrations. The table below is retained as planning context: rows marked as already implemented by the current snapshot should be read through `prisma/schema.prisma`; rows not present in Prisma remain future candidates.

### Renames

| v0.1 | v0.2 | Reason |
|---|---|---|
| `organizations` | `accounts` | Aligns with deep research canonical model; tenant root semantics |
| `bookings` | `appointments` | Domain language used across telephony/CRM vendors |
| `lead_events` (kept) | `lead_events` + new `leads` | `leads` becomes the durable prospect/customer record; lead_events stays as the event stream |

### Expansion table status

| Table | Purpose |
|---|---|
| `events` | Historical planning name. Current implemented webhook ingest record is `WebhookEvent`; broader immutable event-ledger expansion remains future work. |
| `leads` | Future candidate. Current code uses `Contact` + `LeadEvent`. |
| `locations` | Branches / service areas, per account |
| `call_segments` | Turn-by-turn legs (speaker, sequence, text, confidence, redacted_text) |
| `call_transcripts` | Full transcript artifacts with PII redaction + storage policy + expiry |
| `qa_logs` | Call QA scoring + review (rubric_version, findings_json, reviewer_type) |
| `quotes` | Estimate header (replaces `quote_requests` in expanded form) |
| `quote_items` | Line items (sku, qty, unit_price, labor_minutes) |
| `quote_versions` | Revision history (diff_json, version_no) |
| `followups` | SMS/email/call reminders + drip sequences |
| `payments` | Charges, deposits, BNPL, refunds (provider, payment_id, amount, status, payment_type) |
| `billing_accounts` | AJ ↔ tenant billing relationship (plan_code, billing_model, outcome_fee_terms) |
| `usage_meters` | Platform usage for rebilling (meter_type, quantity, unit_cost, period) |
| `invoices` | AJ invoices to clients (subtotal, usage_total, outcome_total) |
| `roi_metrics` | Replaces `revenue_metrics` with expanded KPI facts |
| `workspaces` | Sub-tenant grouping below `accounts` (multi-location, multi-brand operators) |
| `provider_connections` | Implemented as connection metadata. Live credential usage remains v0.3-gated. |
| `audit_logs` | Admin actions, prompt changes, break-glass entries, data exports |
| `conversations` | SMS thread root grouping inbound + outbound messages by contact + tenant |
| `sms_messages` | Per-message rows under a conversation (provider, direction, body, status, segment count) |
| `webhook_events` | Implemented for vendor HTTP callbacks (raw body, signature header, signature_valid, dedupe_hash). |
| `workflow_runs` | n8n / internal workflow execution log (run_id, workflow_id, status, started_at, ended_at, error) |
| `outcome_fees` | Computed performance fees per period per tenant with evidence references |
| `billing_events` | Stripe-side billing state changes mirrored locally (invoice.created, paid, refunded) |
| `files` / `media` | Uploaded artifacts (quote photos, recordings, exports) with R2/S3 keys + retention policy |
| `consent_records` | Per-contact consent state (recording, AI handling, marketing) with jurisdiction + timestamp |

### Why event-ledger-first

Storing the raw event before mutating any business object means we can:
- **Replay** vendor traffic if a downstream consumer was wrong.
- **Audit** any outcome with full provenance.
- **Migrate** between CRMs without rewriting business logic — recompute facts from `events`, not from QuoteIQ vs HighLevel vs HubSpot payload shapes.
- **Recompute ROI** independently of which downstream system holds the data of record.

### Historical migration sketch

This sketch is retained for provenance. Steps that have shipped are represented by the migrations listed in the current implementation snapshot above.

1. Add `events` table; backfill from existing `calls`, `lead_events`, `bookings` rows where derivable.
2. Add `leads` table; map existing `contacts` + `lead_events` into normalized `leads`.
3. Split `quote_requests` → `quotes` + `quote_items` + `quote_versions`.
4. Split `bookings` → `appointments` (rename) and add referential FKs to `quotes`.
5. Add `call_segments` + `call_transcripts` only when transcript ingest goes live (v0.3).
6. Add billing/payments/invoices when Stripe lands (v0.3).
7. Keep `revenue_metrics` running alongside `roi_metrics` until the new mart proves out, then deprecate.

The v0.1 schema was forward-compatible with the shipped v0.2 expansion. Future schema changes should now start from the current Prisma schema and create new migrations rather than reusing this historical sketch as an implementation plan.

---

## Bounded prospect-bootstrap knowledge slice (ADR-0048)

ADR-0048 implements a deliberately narrow subset for short-lived, operator-controlled `sandbox` accounts. `prospect_bootstraps`, `knowledge_ingestion_runs`, `knowledge_sources`, `knowledge_facts`, and `business_memory_snapshots` provide website provenance, cross-source references, fact-level review, immutable approved context, and expiry without embeddings, vector search, free-form retrieval, file uploads, client logins, or production activation. Each fact may persist bounded per-source evidence metadata (source URL/content hash, retrieval time, and evidence-excerpt hash); approved snapshots add reviewer identity/time and confidence without copying raw excerpts into agent context. `review_expires_at` owns the renewable seven-day pre-activation review window, while `expires_at` owns the ready/active/post-demo TTL and cleanup clock. `converted_at` records only an explicit promotion-import acknowledgment. `telephony_numbers` and temporal `telephony_number_assignments` bind a called number to one bootstrap; `bootstrap_promotions` records an allowlisted export manifest and its explicit import handshake. Every tenant-bearing row carries `account_id`, and source/caller content is purged independently on the 30-day demo schedule.

This slice does not implement the general layer described below. It is available only under ADR-0048's operator, environment, retention, and supervised-demo gates.

## Future Knowledge Layer (v0.4+) — planning only beyond ADR-0048

ResponseOS may later add a general client-specific **knowledge layer** that grounds AI voice, SMS, booking, quote, and support workflows in approved business knowledge. Those production/client-facing capabilities remain roadmap candidates for v0.4 or later. ADR-0048 authorizes only the bounded prospect-demo subset above.

Architectural placement and product framing are documented in `architecture.md` and `research-report.md`. Roadmap gating and required security controls are documented in `ROADMAP.md` and `SECURITY.md`.

### Future tables (planning candidates)

| Table | Purpose |
|---|---|
| `knowledge_sources` | Per-tenant registry of approved knowledge sources (FAQs, SOPs, scripts, manuals, CRM notes, transcripts) with source ownership, ingestion mode, and approval status. |
| `knowledge_documents` | Document-level records under a source, with title, version, language, sensitivity, retention class, and approval state. |
| `knowledge_chunks` | Sub-document units used for retrieval; structure is intentionally undefined until v0.4 picks an embedding/retrieval strategy. |
| `knowledge_tags` | Tenant-scoped tags for routing knowledge to specific workflows (booking, quoting, escalation, after-hours). |
| `knowledge_links` | Edges between knowledge documents and other ResponseOS entities (services, locations, pricing rules, scripts, automations) so retrieval is workflow-aware. |
| `knowledge_ingestion_runs` | Per-source ingestion job log: started_at, ended_at, status, error, counts, source-version, ingestor identity. |
| `knowledge_review_status` | Human-review state for sensitive knowledge: reviewer, decision, expires_at, review_notes. |
| `knowledge_usage_events` | Per-call / per-message record of which knowledge was consulted to ground a response, joined to the event ledger for ROI and audit. |

### Modeling rules these future tables must follow

- Every knowledge table carries `account_id` (the v0.2 tenant root) and respects the same tenant-isolation rules as every other per-tenant table.
- Every knowledge document has an explicit owner, an explicit approval state, and an explicit retention policy before it is eligible for retrieval.
- Knowledge consulted during a workflow is recorded against the immutable event ledger (`events`) so any AI-grounded answer is auditable and replayable.
- PII minimization rules in `SECURITY.md` apply to ingested transcripts and CRM notes; raw and redacted variants live under different storage paths and access policies.
- No knowledge ingestion path is enabled for a tenant until that tenant's deployment lane (Standard / Privacy-hardened / HIPAA-ready) has the controls listed in `ROADMAP.md` § Future Knowledge Layer in force.

### Explicitly out of scope right now

- No vector / embeddings columns are committed to. The retrieval substrate is a v0.4 decision.
- No file-upload schema is committed to. Uploads are gated on the `files` / `media` model already on the v0.2 roadmap above.
- No third-party knowledge integrations (Obsidian, Notion, Confluence, etc.) are committed to.
- No additional general-knowledge Prisma models, retrieval runtime, or provider integration ships from this roadmap entry.
