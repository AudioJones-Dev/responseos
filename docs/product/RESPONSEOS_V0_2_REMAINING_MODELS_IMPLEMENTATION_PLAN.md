# v0.2 Remaining Models Implementation Plan

**Owner:** AJ Digital LLC / Audio Jones
**Status:** Planning only (v0.2 closeout step 2.3 planning pass). **No code, schema, migration, generated-client, runtime, auth, deploy, UI, or seed-idempotency changes ship with this artifact.**
**Anchored by:** ADR-0001 (mock-first), ADR-0002 (event-ledger-first), ADR-0009 (webhook signature validation), ADR-0013 (voice gateway), ADR-0017 (n8n async), ADR-0019 (closeout-first).
**Tracks:** issue #27 (roadmap checkpoint). Per ADR-0019 step 2.3.
**Read first:** [`docs/data-schema.md`](../data-schema.md) (v0.2 roadmap), [`docs/architecture/RESPONSEOS_DATA_MODEL.md`](../architecture/RESPONSEOS_DATA_MODEL.md), [`docs/architecture/RESPONSEOS_BACKEND_SPEC.md`](../architecture/RESPONSEOS_BACKEND_SPEC.md), [`docs/architecture/RESPONSEOS_EVENT_SCHEMA.md`](../architecture/RESPONSEOS_EVENT_SCHEMA.md).

> This is a planning-only artifact. It enumerates the eight remaining v0.2-spec model targets, maps each to a concrete Prisma shape, identifies seed/mock/data-layer/test/API/migration implications, recommends a PR split, surfaces open questions, and states the operator gate required before any implementation begins. **The operator must explicitly authorize the next implementation PR before any code lands.**

---

## 1. Current State

After PRs #29 and #30, `master` is at `518bf745` with v0.2 closeout steps **2/5 complete**:

| Surface | After step 2.2 |
|---|---|
| Schema | 14 models present: `Account`, `User`, `Contact`, `Call`, `LeadEvent`, `LeadQualification`, `Appointment`, `QuoteRequest`, `Automation`, `Notification`, `RevenueMetrics`, `AssessmentReport`, `Engagement`, `AuditLog`, `WebhookEvent`. Renamed `Organization → Account` (PR #29) and `Booking → Appointment` (PR #30). |
| Migrations | `0001_v0_2_foundation`, `0002_organization_to_account_rename`, `0003_booking_to_appointment_rename`. Logical FKs only — no enforced `FOREIGN KEY` constraints in any migration. |
| Data layer | `lib/data/*` accessors per model, all using the `Result<T>` envelope + `withTenantScope(accountId)` discipline; `recordAuditLog` already exists as the append-only writer. |
| Mocks | `lib/mock/*` fixtures with stable `*_mock_*` ids; seed at `prisma/seed.ts` is byte-for-byte parity-tested against mocks. |
| Tests | 54 unit / 65 integration pass on master. |
| Pending closeout (after step 2.3) | step 2.4 Clerk auth alignment (ADR-0005) → step 2.5 UI rebuild against `DESIGN.md` tokens → v0.3 demo deploy unlocks (ADR-0019). |

### What this PR does NOT add

`events` (the full ledger table) is **not** in step 2.3 scope per the operator authorization. The ledger ships as a separate roadmap item; step 2.3's surfaces (especially `call_segments`, `call_transcripts`, `workflow_runs`, `audit_logs` expansion) are designed to be **forward-compatible** with the ledger — they hold normalized facts that derive from ledger events, not the ledger itself.

---

## 2. Conventions (inherited — apply to every new model below)

- **snake_case columns** to match JSON/API shapes (`docs/data-schema.md` §0; `RESPONSEOS_DATA_MODEL.md` §1).
- **Tenant isolation:** every per-tenant table carries `account_id String` (non-null where the row is unambiguously tenant-scoped; nullable only for cross-tenant rows like the `AuditLog` system entries). `account_id` is **always derived from session, never from client input** (AGENTS.md security rule; ADR-0019).
- **Money in cents** (Int).
- **JSON config** uses Postgres `Json` (Prisma type `Json`).
- **IDs are `cuid()` strings**; timestamps are `DateTime @default(now())` + `@updatedAt` where mutable.
- **Logical FKs only** — no `@relation` blocks, matching the existing schema discipline (ADR-0003 evolution; verified across all three existing migrations).
- **Standard indexes:** `@@index([account_id])` on every per-tenant table; plus the field-specific indexes a model's accessor will query on (chronological, status, parent-id).
- **Mock parity:** every new model gets a `lib/mock/<table>.ts` fixture file paired with byte-identical seed entries in `prisma/seed.ts`. Stable `*_mock_*` id prefixes (the existing convention).
- **Append-only contract for ledger-adjacent tables** (`call_segments`, `call_transcripts`, `qa_logs`, `audit_logs`, eventually `events`): no `@updatedAt`; corrections are new rows, not edits.
- **Data-layer pattern:** `lib/data/<table>.ts` exposes `Result<T>`-enveloped read accessors and (where applicable) a single append-only writer; mock-fallback when `db === null`; no client-supplied tenant id ever trusted.

---

## 3. Model-by-Model Plan

Each entry follows a 12-cell schema. Field tables are intentional sketches at planning fidelity, not final field lists — see Open Questions §6 for the items that must be operator-decided before implementation.

---

### 3.1 `provider_connections`

| Item | Detail |
|---|---|
| **Prisma model** | `ProviderConnection` |
| **Table** | `"ProviderConnection"` (Prisma default PascalCase) |
| **Purpose** | Per-tenant encrypted credentials and OAuth tokens for the providers ResponseOS integrates with (Twilio, Grok, OpenAI, HubSpot, Google Calendar, Cal.com, Stripe). Foundational substrate that downstream consumers (voice gateway, normalizer, CRM mirror, calendar sync, billing) all read from. Source: `RESPONSEOS_DATA_MODEL.md` §4.4; `docs/data-schema.md` v0.2 expansion table. |
| **Required fields** | `id` (cuid PK) · `account_id` (FK, not null) · `provider` (enum) · `credentials_encrypted` (Bytes or `Json` of encrypted blobs — **see Open Question Q1**) · `oauth_refresh_token_encrypted` (Bytes? — optional, for OAuth providers) · `status` (enum) · `scopes` (`String[]` — Postgres native array) · `connected_by` (user id, not null) · `last_verified_at` (`DateTime?`) · `created_at`, `updated_at`. |
| **Enums (new)** | `ProviderConnectionProvider`: `twilio`, `grok`, `openai`, `retell`, `vapi`, `bland`, `hubspot`, `google_calendar`, `calcom`, `stripe`. `ProviderConnectionStatus`: `connected`, `disconnected`, `error`, `expired`. |
| **Indexes** | `@@index([account_id])` · `@@unique([account_id, provider])` (one connection per provider per tenant — confirm in Open Q2) · `@@index([status])`. |
| **Logical FKs** | `account_id` → `Account.id`; `connected_by` → `User.id`. Both unenforced per existing schema discipline. |
| **Seed/mock impact** | Seed two mock connections for `org_mock_1` (mock Twilio + mock HubSpot in `connected` state with `credentials_encrypted` = a redacted sentinel string like `"<MOCK_REDACTED>"`); zero for `org_mock_2`. New `lib/mock/providerConnections.ts` with `MockProviderConnection()` factory + `mockProviderConnections` array + `getMockProviderConnections()` accessor. Parity-tested. |
| **Data-layer impact** | New `lib/data/providerConnections.ts`: `listProviderConnections({ accountId })`, `getProviderConnectionByProvider({ accountId, provider })`. Writer `upsertProviderConnection(...)` deferred — provisioning lands in step 2.4 (Clerk) / v0.3 (live integrations). Reads return the `credentials_encrypted` field **as opaque bytes** and never log it; decryption happens at the provider-adapter boundary, not in the accessor. Mock-fallback returns `getMockProviderConnections()`. Update `lib/data/index.ts` barrel `ProviderConnections`. |
| **API impact** | **No public API surface in v0.2.** No `app/api/provider-connections/` route. Reads consumed only by internal call sites (voice gateway adapters, CRM mirror) once those land in v0.3. Optional: a future admin-side `GET /api/internal/provider-connections` for AJ-internal status reporting, gated by `aj_admin` role — explicitly **out of scope** for step 2.3. |
| **Test impact** | New `tests/factories/providerConnections.ts` with `makeProviderConnection`. New integration tests: read isolation by `account_id` (client_admin@org_mock_1 sees only org_mock_1's connections); unique constraint per `(account_id, provider)`; cross-tenant read returns empty. Add to `tests/integration/setup.ts` `TABLES` truncation list (in dependency order — independent table, safe at any position). Add to `tests/integration/seed-determinism.integration.test.ts` `TABLE_READS`. |
| **Migration risk** | **Low.** Pure additive: new enum types, new table, new indexes. Zero data movement. Zero impact on existing rows. No FK constraints to rebuild. Reversible via `DROP TABLE` if rolled back (no consumers in v0.2 → no downstream cleanup). |

---

### 3.2 `conversations`

| Item | Detail |
|---|---|
| **Prisma model** | `Conversation` |
| **Table** | `"Conversation"` |
| **Purpose** | SMS thread root grouping inbound + outbound messages by `(account_id, contact_id, business_number)`. One conversation = one ongoing message stream with one party, on one tenant phone number. Per `docs/data-schema.md` v0.2 expansion. Foundation for the `sms_messages` per-row table (§3.3). |
| **Required fields** | `id` (cuid PK) · `account_id` (not null) · `contact_id` (`String?` — nullable for unidentified/early-stage threads; resolved on first match) · `business_number` (E.164 — the tenant's number) · `peer_number` (E.164 — the customer's number) · `status` (enum — confirm in Open Q3) · `last_message_at` (DateTime, denormalized for ordering) · `created_at`, `updated_at`. |
| **Enums (new)** | `ConversationStatus`: `open`, `archived`, `blocked`, `spam`. (Sketch — see Open Q3.) |
| **Indexes** | `@@index([account_id])` · `@@unique([account_id, business_number, peer_number])` (one conversation per number-pair per tenant) · `@@index([contact_id])` · `@@index([last_message_at])` (chronological list ordering). |
| **Logical FKs** | `account_id` → `Account.id`; `contact_id` → `Contact.id` when set. |
| **Seed/mock impact** | One mock conversation per seeded org (org_mock_1 → contact_mock_1, org_mock_2 → contact_mock_3) in `open` status, no `sms_messages` attached yet (those land per §3.3's seed). Stable id prefix `conv_mock_*`. New `lib/mock/conversations.ts`. |
| **Data-layer impact** | New `lib/data/conversations.ts`: `listConversations({ accountId })`, `getConversationById(id)`, `findOrCreateConversation({ accountId, businessNumber, peerNumber, contactId })` — the find-or-create is the write path the SMS ingest webhook will call in v0.3 (planning only; not implemented yet). Mock-fallback. Update barrel `Conversations`. |
| **API impact** | **No public API surface in v0.2.** Internal-only via `lib/data/*` accessors. Future client portal SMS view (UI rebuild step 2.5 / v0.3) reads via this layer. |
| **Test impact** | New `tests/factories/conversations.ts`. Integration tests: tenant isolation; unique `(account_id, business_number, peer_number)`; find-or-create idempotency (calling twice with same key returns same row). Truncation list + parity test add. |
| **Migration risk** | **Low — but ordering-sensitive.** Must land in the same migration as `sms_messages` (§3.3) if Prisma needs both to be present before either can be migrated (validate during implementation — they're independent tables, but the `Conversation`/`SmsMessage` PR ships as one logical migration to keep the parent/child consistent). |

---

### 3.3 `sms_messages`

| Item | Detail |
|---|---|
| **Prisma model** | `SmsMessage` |
| **Table** | `"SmsMessage"` |
| **Purpose** | Per-message row under a `Conversation`. Append-only stream from Twilio SMS webhooks (inbound) and the outbound dispatcher. Source: `docs/data-schema.md`. |
| **Required fields** | `id` (cuid PK) · `account_id` (not null — denormalized from parent for index/scope ergonomics) · `conversation_id` (not null) · `provider` (enum) · `provider_message_id` (`String?` — Twilio `MessageSid`) · `direction` (enum) · `from_number`, `to_number` (E.164) · `body` (String) · `status` (enum) · `segment_count` (Int default 1 — Twilio reports per message) · `error_code` (`String?`), `error_message` (`String?`) · `sent_at` (`DateTime?`) · `delivered_at` (`DateTime?`) · `created_at` (no `updated_at` — append-only). |
| **Enums (new)** | `SmsProvider`: `twilio`, `manual`. (Mirrors `CallProvider` discipline.) `SmsDirection`: `inbound`, `outbound`. `SmsMessageStatus`: `queued`, `sending`, `sent`, `delivered`, `failed`, `received`. |
| **Indexes** | `@@index([account_id])` · `@@index([conversation_id])` · `@@index([created_at])` · `@@unique([provider, provider_message_id])` (replay-safety: Twilio retries on the same `MessageSid` must not create duplicates — supports the dedupe rule from `RESPONSEOS_EVENT_SCHEMA.md` §4). Nullable+unique requires careful handling — see Open Q4. |
| **Logical FKs** | `account_id` → `Account.id`; `conversation_id` → `Conversation.id`. Both unenforced. |
| **Seed/mock impact** | Two seeded messages per seeded conversation (one inbound, one outbound) to exercise both directions. Stable id prefix `sms_mock_*`. Times anchored to the same `BASE_TIME` pattern as `calls.ts` so dashboards stay deterministic. New `lib/mock/smsMessages.ts`. |
| **Data-layer impact** | New `lib/data/smsMessages.ts`: `listSmsMessagesByConversation({ accountId, conversationId })`, `recordSmsMessage(...)` (append-only writer paralleling `recordAuditLog`'s shape). Mock-fallback. Update barrel `SmsMessages`. |
| **API impact** | **No public API surface in v0.2.** The inbound Twilio SMS webhook handler (`/api/webhooks/twilio/sms`) is **not implemented in step 2.3** — it would land with provider wiring in v0.3 once signatures-validate per ADR-0009. The substrate (model + accessor + factory + tests) ships now; the consumer ships later. |
| **Test impact** | New `tests/factories/smsMessages.ts`. Integration tests: tenant isolation; conversation scoping (messages from another conversation invisible); dedupe key uniqueness; `recordSmsMessage` is idempotent on `(provider, provider_message_id)`. |
| **Migration risk** | **Low.** Pure additive. **Ships in the same PR/migration as `conversations`** (§3.2) — the schema-prisma validation needs both present together. |

---

### 3.4 `call_segments`

| Item | Detail |
|---|---|
| **Prisma model** | `CallSegment` |
| **Table** | `"CallSegment"` |
| **Purpose** | Turn-by-turn record of a call — one row per finalized turn. Holds speaker, sequence number, text, confidence, and redacted text. Per `docs/data-schema.md` and `RESPONSEOS_DATA_MODEL.md` §6. Per `RESPONSEOS_EVENT_SCHEMA.md` §9 Open Q1: partials are Redis-only, finalized turns ledger. **call_segments = finalized turns** (confirm in Open Q5). |
| **Required fields** | `id` (cuid PK) · `account_id` (not null, denormalized from `Call`) · `call_id` (not null) · `sequence` (Int — strictly increasing per call_id) · `speaker` (enum) · `text` (String — already lane-redacted per `RESPONSEOS_BACKEND_SPEC.md` §9 normalizer) · `redacted_text` (`String?` — when separate redacted variant retained) · `confidence` (`Float?`) · `started_at`, `ended_at` (`DateTime` — both required for turn analytics) · `created_at` (append-only). |
| **Enums (new)** | `CallSegmentSpeaker`: `caller`, `agent`, `system`. |
| **Indexes** | `@@index([account_id])` · `@@index([call_id])` · `@@unique([call_id, sequence])` (idempotent normalizer re-runs must not duplicate turns) · `@@index([created_at])`. |
| **Logical FKs** | `account_id` → `Account.id`; `call_id` → `Call.id`. |
| **Seed/mock impact** | Two seeded segments under `call_mock_2` (the answered call) — one `caller` turn, one `agent` turn — sequence 1 and 2. Zero segments for `call_mock_1` (missed), `call_mock_3` (spam), `call_mock_4` (outbound completed; could add but keep narrow). Stable id prefix `seg_mock_*`. New `lib/mock/callSegments.ts`. |
| **Data-layer impact** | New `lib/data/callSegments.ts`: `listCallSegmentsByCall({ accountId, callId })`, `recordCallSegment(...)` (append-only). Mock-fallback. Update barrel `CallSegments`. |
| **API impact** | **No public API surface in v0.2.** Internal-only. The post-call normalizer (`RESPONSEOS_BACKEND_SPEC.md` §9) is the sole writer; it lands in v0.3 with live voice providers. |
| **Test impact** | Factory + integration: tenant isolation, sequence uniqueness per `call_id`, ordering preservation, mock fallback returns the seeded turns. |
| **Migration risk** | **Low.** Additive. No impact on `Call` rows. |

---

### 3.5 `call_transcripts`

| Item | Detail |
|---|---|
| **Prisma model** | `CallTranscript` |
| **Table** | `"CallTranscript"` |
| **Purpose** | Per-call full transcript artifact with raw/redacted storage refs, retention policy, and expiry. Per `RESPONSEOS_DATA_MODEL.md` §6 + `SECURITY.md` retention table. Pairs with `call_segments` (turns) but holds the full-text artifact references. |
| **Required fields** | `id` (cuid PK) · `account_id` (not null) · `call_id` (not null, unique — one transcript per call) · `raw_ref` (`String?` — object storage key for raw transcript; null when retention lane = `metadata_only`) · `redacted_ref` (`String?` — object storage key for redacted variant) · `inline_text` (`String?` — fallback when object storage not yet configured — **see Open Q6**) · `language` (String default `"en"`) · `retention_lane` (enum — mirrors compliance lane from ADR-0004) · `expires_at` (`DateTime?` — null = no expiry; set per lane) · `redacted_at` (`DateTime?`) · `created_at` (append-only). |
| **Enums (new)** | `TranscriptRetentionLane`: `full`, `redacted_only`, `metadata_only`. (Matches `SECURITY.md` retention table.) |
| **Indexes** | `@@index([account_id])` · `@@unique([call_id])` (one transcript per call) · `@@index([expires_at])` (TTL/cleanup job query). |
| **Logical FKs** | `account_id` → `Account.id`; `call_id` → `Call.id`. |
| **Seed/mock impact** | One seeded transcript for `call_mock_2` with `inline_text` = the existing `Call.transcript` text from the seed (reuse rather than duplicate), `retention_lane: "full"`, `raw_ref: null`, `redacted_ref: null` (no object storage yet). Zero transcripts for other calls in v0.2 fixtures. Stable id prefix `xcr_mock_*`. New `lib/mock/callTranscripts.ts`. |
| **Data-layer impact** | New `lib/data/callTranscripts.ts`: `getCallTranscriptByCall({ accountId, callId })`, `recordCallTranscript(...)`. Mock-fallback. Update barrel `CallTranscripts`. Access to `raw_ref` is **never returned to non-`aj_admin` callers** — gate at the accessor (`isCrossTenantRole` is insufficient; must be `aj_admin` specifically with break-glass logging — see Open Q7). |
| **API impact** | **No public API surface in v0.2.** Internal-only. Future read endpoints are gated on break-glass discipline (`RESPONSEOS_DATA_MODEL.md` §6, `SECURITY.md`). |
| **Test impact** | Factory + integration: tenant isolation, one-per-call uniqueness, `raw_ref` access gated by role (negative tests for `client_admin`/`operator` getting redacted-only view). |
| **Migration risk** | **Low for substrate.** Object-storage integration is **explicitly out of scope** — the model holds the *refs* but no R2/S3 wiring lands in v0.2. The `Call.transcript` String column is retained for backward compatibility; it does not get deleted in this PR (see Open Q8 on eventual migration). |

---

### 3.6 `qa_logs`

| Item | Detail |
|---|---|
| **Prisma model** | `QaLog` |
| **Table** | `"QaLog"` |
| **Purpose** | Call QA scoring and reviewer findings. Per `docs/data-schema.md` v0.2 expansion. Each row = one QA pass over one call by one reviewer (human or system). |
| **Required fields** | `id` (cuid PK) · `account_id` (not null) · `call_id` (not null) · `rubric_version` (String — versioning of the QA rubric used; see Open Q9) · `reviewer_type` (enum) · `reviewer_user_id` (`String?` — null for system QA) · `score` (`Int?` 0..100) · `findings_json` (`Json` — structured rubric-item results) · `notes` (`String?`) · `reviewed_at` (DateTime not null) · `created_at` (append-only). |
| **Enums (new)** | `QaReviewerType`: `human`, `system`, `automated_llm`. |
| **Indexes** | `@@index([account_id])` · `@@index([call_id])` · `@@index([reviewed_at])`. **No `@@unique` on `(call_id, rubric_version)`** — a call may be re-reviewed under the same rubric; the latest row wins by `reviewed_at` ordering. (Confirm in Open Q10.) |
| **Logical FKs** | `account_id` → `Account.id`; `call_id` → `Call.id`; `reviewer_user_id` → `User.id` when set. |
| **Seed/mock impact** | One seeded QA log on `call_mock_2` (the answered call): `rubric_version: "v1"`, `reviewer_type: "system"`, `score: 84`, `findings_json: { "greeting": "pass", "qualification": "pass", "next_step": "pass" }`. Stable id prefix `qa_mock_*`. New `lib/mock/qaLogs.ts`. |
| **Data-layer impact** | New `lib/data/qaLogs.ts`: `listQaLogsByCall({ accountId, callId })`, `recordQaLog(...)`. Mock-fallback. Update barrel `QaLogs`. |
| **API impact** | **No public API surface in v0.2.** The QA review UI is **explicitly UI work** — excluded per step 2.3 scope. Reviewer-bot writer lands in v0.3+ once the LLM grading pipeline is wired. |
| **Test impact** | Factory + integration: tenant isolation, multi-rubric history preserved per call, `reviewer_user_id` null vs not-null variants. |
| **Migration risk** | **Low.** Additive. No `Call`-row impact. |

---

### 3.7 `workflow_runs`

| Item | Detail |
|---|---|
| **Prisma model** | `WorkflowRun` |
| **Table** | `"WorkflowRun"` |
| **Purpose** | n8n / internal async workflow execution log. Per `RESPONSEOS_EVENT_SCHEMA.md` §6 ("every async run … is logged to `workflow_runs`") and `docs/data-schema.md` v0.2 expansion. Idempotency anchor — replays of the same `workflow_run_id` are no-ops. |
| **Required fields** | `id` (cuid PK) · `account_id` (not null) · `workflow_run_id` (String unique — provider-supplied or generated; the dedupe key per EVENT_SCHEMA §4) · `workflow_id` (String — n8n workflow name or internal worker name; not a FK, just a label — see Open Q11) · `provider` (enum) · `trigger_event_id` (`String?` — future FK into `events` ledger; until ledger lands, holds a string id of the triggering thing, or null for scheduled runs) · `status` (enum) · `started_at` (DateTime not null) · `ended_at` (`DateTime?`) · `error_message` (`String?`) · `payload_json` (`Json?`) · `created_at` (append-only). |
| **Enums (new)** | `WorkflowRunProvider`: `n8n`, `internal`, `make`. (Mirrors existing `WorkflowProvider` enum — **see Open Q12** on whether to reuse or duplicate.) `WorkflowRunStatus`: `started`, `completed`, `failed`, `cancelled`, `dead_letter`. |
| **Indexes** | `@@index([account_id])` · `@@unique([workflow_run_id])` (idempotency spine — EVENT_SCHEMA §4) · `@@index([workflow_id])` · `@@index([status])` · `@@index([started_at])`. |
| **Logical FKs** | `account_id` → `Account.id`. `trigger_event_id` deliberately untyped FK for now (future link into `events` ledger). |
| **Seed/mock impact** | Two seeded runs: one `completed` (`missed_call_recovery` workflow, started+ended in the past), one `failed` (`new_lead_followup`, with `error_message: "vendor_unavailable"`). Stable id prefix `wfr_mock_*`. New `lib/mock/workflowRuns.ts`. |
| **Data-layer impact** | New `lib/data/workflowRuns.ts`: `listWorkflowRuns({ accountId, status?, workflowId? })`, `recordWorkflowRunStarted(...)`, `recordWorkflowRunCompleted(...)`, `recordWorkflowRunFailed(...)`. The three writers are idempotent on `workflow_run_id` (re-call with same id is a no-op). Mock-fallback. Update barrel `WorkflowRuns`. |
| **API impact** | **No public API surface in v0.2.** The n8n callback handler that emits `workflow.run_started`/`completed`/`failed` events ships in v0.3 with the async wiring; substrate ships now. |
| **Test impact** | Factory + integration: tenant isolation; idempotency on `workflow_run_id`; status filter; the three writers are net no-ops when called with a known `workflow_run_id` regardless of payload. |
| **Migration risk** | **Low.** Additive. The `workflow_id` string-vs-FK decision (Open Q11) is the only knob with downstream implications, and the chosen answer is forward-compatible either way (string today → migrate to FK later if a `WorkflowDefinition` table ever appears). |

---

### 3.8 (continued in §4 — AuditLog expansion is a different beast and gets its own section)

---

## 4. AuditLog Expansion Plan

**Current `AuditLog` shape (`prisma/schema.prisma` lines 506–523):**

```prisma
model AuditLog {
  id              String    @id @default(cuid())
  account_id      String?
  actor_user_id   String?
  actor_type      ActorType
  action          String
  target_type     String?
  target_id       String?
  metadata_json   Json?
  ip_address      String?
  user_agent      String?
  created_at      DateTime  @default(now())

  @@index([account_id])
  @@index([actor_user_id])
  @@index([action])
  @@index([created_at])
}
```

### What `RESPONSEOS_EVENT_SCHEMA.md` §7 + `SECURITY.md` require

> "Each audit row: `account_id`, `actor` (user id + role), `action`, `target`, `reason` (required for break-glass), `before`/`after` refs, `created_at`. Break-glass is time-boxed and notifies the tenant `client_admin`. Audit logs are immutable and retained ≥ 1 year."

### Field-by-field gap analysis

| Required by spec | Present today | Status / proposed change |
|---|---|---|
| `account_id` | ✅ `account_id` | No change. |
| Actor (user id + role) | ✅ `actor_user_id`, ✅ `actor_type` (`ActorType` enum: `user`/`system`/`webhook`) | **Gap:** `actor_role` is not captured separately. Spec §7 says "actor (user id + role)". **Proposal:** add `actor_role UserRole?` (nullable for system/webhook actors). |
| `action` | ✅ `action` (String) | No change. |
| `target` (`target_type` + `target_id`) | ✅ both | No change. |
| `reason` (required for break-glass) | ❌ Not present | **Proposal:** add `reason String?` (null for routine actions; non-null required at the app layer for any action of `actor_type = "user"` and `category = "break_glass"`). |
| `before` / `after` refs | ❌ Not present | **Proposal:** add `before_ref Json?` and `after_ref Json?`. Holds either inline snapshot of the changed fields (small) or `{ "ref": "object-storage-key" }` for large diffs. The inline-vs-ref pivot mirrors `call_transcripts.inline_text` vs `raw_ref` (§3.5). |
| Immutability | ⚠ No `@updatedAt` (good) but no DB-level enforcement | **Proposal:** continue to omit `@updatedAt`; document the immutability invariant in `lib/data/auditLogs.ts` (already partly there: "append-only writer", "never throws back to the caller"). DB-level enforcement (revoking `UPDATE`/`DELETE` grants from the app role) is **infra work outside this PR's scope** (call out in Open Q13). |
| Break-glass time-boxing | ❌ Not present | **Proposal:** add `expires_at DateTime?` (null for routine entries; required at app layer for `category = "break_glass"`). |
| Category | ❌ Not present | **Proposal:** add `category AuditCategory?` enum: `routine`, `break_glass`, `export`, `config_change`, `prompt_change`, `policy_change`, `connection_change`. Helps filtering/reporting and clarifies which rows require `reason`/`expires_at`. |
| Notify-client-admin contract | n/a (app behavior) | **Out of scope for this PR.** The notification dispatch lands when the consumer is wired (v0.3 admin tooling). Schema is forward-compatible. |

### Proposed migration shape (additive only)

```prisma
model AuditLog {
  id              String          @id @default(cuid())
  account_id      String?
  actor_user_id   String?
  actor_type      ActorType
  actor_role      UserRole?       // NEW
  action          String
  category        AuditCategory?  // NEW (nullable to keep existing rows valid)
  target_type     String?
  target_id       String?
  reason          String?         // NEW
  before_ref      Json?           // NEW
  after_ref       Json?           // NEW
  expires_at      DateTime?       // NEW (break-glass time-box)
  metadata_json   Json?
  ip_address      String?
  user_agent      String?
  created_at      DateTime        @default(now())

  @@index([account_id])
  @@index([actor_user_id])
  @@index([action])
  @@index([category])              // NEW
  @@index([created_at])
}

enum AuditCategory {                // NEW
  routine
  break_glass
  export
  config_change
  prompt_change
  policy_change
  connection_change
}
```

### Backfill / data impact

- Six new columns, **all nullable, no defaults required.** Existing rows remain valid.
- One new enum type (`AuditCategory`).
- One new index (`@@index([category])`).
- One new optional FK-shaped field (`actor_role` reuses the existing `UserRole` enum — no new enum, no `@relation`).
- **Zero data movement.** Existing 6 seeded `AuditLog` rows continue to validate as-is (all 6 new columns simply read `null` on those rows).
- `lib/data/auditLogs.ts` `recordAuditLog` writer gets six new optional parameters; `listAuditLogs` gets one new optional filter (`category`).
- `tests/factories/auditLogs.ts` factory `makeAuditLog` gets six new optional fields.

### Seed update

Optionally extend `audit_mock_5` and `audit_mock_6` to demonstrate the new categories: set `category: "routine"` on existing entries; add `audit_mock_7` with `category: "break_glass"`, `reason: "Incident #demo investigation"`, `expires_at: <+1h>` to exercise the break-glass path in mock-parity tests. **This is optional and adds one seeded row; can also defer to a follow-up parity sweep.**

### Migration risk for AuditLog expansion

**Very low.** Pure additive columns + one new enum + one new index. Reversible. The only operator decision is the precise shape of `AuditCategory` enum values (Open Q14).

---

## 5. Recommended PR Split

### 5.1 Recommendation: **four scoped PRs**, in this order

| PR | Models | Why this grouping | Size signal | Order rationale |
|---|---|---|---|---|
| **31A — Provider connections + communication substrate** | `provider_connections`, `conversations`, `sms_messages` | `provider_connections` is the foundation for SMS/voice providers; `conversations` + `sms_messages` are tightly coupled parent/child and need the same migration. | ~25–30 files (3 models × ≈8 surfaces) | First because `provider_connections` is the schema substrate every later integration consumer reads from; conversations/sms_messages pair early so the SMS substrate is in place when the Twilio webhook lands in v0.3. |
| **31B — Call intelligence substrate** | `call_segments`, `call_transcripts`, `qa_logs` | All three attach to `Call` and form the post-call normalization output surface (BACKEND_SPEC §9). Reviewing them together preserves the data-flow context. | ~25 files | Second because it builds on `Call` which is stable; ships before workflow execution so any normalization hooks have somewhere to write. |
| **31C — Workflow execution substrate** | `workflow_runs` | Standalone surface, no parent/child dependency; small enough to keep separate for clean idempotency-test review. | ~10–12 files | Independent of 31B; can land in parallel with 31B if reviewer bandwidth allows, but recommend sequential to keep migrations linear (`0004 → 0005 → 0006 → 0007`). |
| **31D — AuditLog expansion** | `audit_logs` (additive columns + enum + index) | Touches an *existing* table — different migration shape (additive `ALTER TABLE ... ADD COLUMN` rather than `CREATE TABLE`). Smallest blast radius. | ~10 files | Last because it modifies a load-bearing existing model; landing it after the new tables means each test suite ratchets up one model at a time, and the `expires_at` / `before_ref` / `after_ref` semantics can be validated against the existing 6 seeded audit entries without merge conflicts with 31A–C. |

### 5.2 Why not one big PR

- **Reviewability:** a single PR adding 7 new models + expanding an 8th would be 100+ files. The rename PRs (#29 at 109 files; #30 at 34 files) showed that even mechanical PRs at that scale require careful operator-side review. Substantive schema additions deserve smaller chunks.
- **Migration ordering:** four sequential migrations (`0004` through `0007`) are trivially reversible one at a time. A single mega-migration mixing seven new tables + one `ALTER TABLE` is harder to roll back surgically if any one piece misbehaves.
- **Independent surfaces:** the four groups have independent downstream consumers (CRM/voice for 31A, normalizer for 31B, n8n for 31C, admin tools for 31D). Splitting them lets each group land + bake before the next.
- **Risk distribution:** if any one PR turns up a problem (e.g., a `@@unique` constraint that breaks an integration test), only that PR's blast is affected.

### 5.3 Why not the alternative split that bundles `provider_connections` separately

A possible alternative: ship `provider_connections` alone first (as 31A'), then bundle conversations+sms_messages (31A''). I considered this but rejected it because:
- `provider_connections` alone has no consumer in v0.2 — it's a substrate table with zero rows-actually-read until v0.3 wiring.
- Co-locating it with `conversations`/`sms_messages` in 31A means the SMS substrate has its provider-credentials home in the same PR, which keeps the "what does the future Twilio webhook need" review coherent.

### 5.4 Migration numbering

The repo's existing migration sequence is `0001` → `0002` → `0003`. This planning step does not consume a migration number. Step 2.3 implementation PRs would be:

- 31A → `0004_provider_connections_and_sms_substrate`
- 31B → `0005_call_intelligence_substrate`
- 31C → `0006_workflow_runs`
- 31D → `0007_audit_logs_expansion`

### 5.5 What ships per PR (substrate-not-consumers)

**Every step-2.3 implementation PR ships substrate only:**

- Prisma model + migration
- Regenerated client artifacts (none tracked — Prisma generates at build time)
- TypeScript type in `types/<name>.ts`
- Data accessor in `lib/data/<name>.ts` with `Result<T>` envelope + tenant scoping
- Mock fixtures in `lib/mock/<name>.ts` + factory in `tests/factories/<name>.ts`
- Seed entries in `prisma/seed.ts` with byte-identical mock parity
- Unit + integration tests
- Active-doc cross-references where the doc names a specific field/route (`data-schema.md`, `architecture/RESPONSEOS_DATA_MODEL.md`, `api-spec.md` if applicable, `AGENTS.md` if applicable)
- CHANGELOG entry

**Every step-2.3 implementation PR explicitly does NOT ship:**

- Live provider integrations (Twilio webhook handler, n8n callback, object storage, etc.)
- API routes for the new tables (substrate stays internal to `lib/data/*`)
- UI surfaces
- Auth wiring changes
- Deploy work
- Doc sweeps outside the schema/API contract docs

---

## 6. Open Questions

Numbered as referenced in §3/§4. Each is a question that needs an explicit operator decision before the corresponding implementation PR opens.

| # | Question | Context | Lives in PR |
|---|---|---|---|
| **Q1** | `provider_connections.credentials_encrypted` — store as Postgres `Bytea` or `Json` of encrypted blobs? Which encryption mechanism — application-layer (env-keyed AES-GCM via a service worker), per-tenant KMS key, or Supabase-managed Vault? | `RESPONSEOS_DATA_MODEL.md` §4.4 says "encrypted at rest, decrypted at request time" but does not pick a mechanism. ADR-0006 (R2/S3) doesn't apply. No existing ADR covers per-tenant key isolation. **Likely needs an ADR before 31A.** | 31A |
| **Q2** | `provider_connections` — one connection per `(account_id, provider)`, or allow multiple (e.g., a tenant with two Twilio sub-accounts)? | One-per-pair is simpler and matches the "Standard lane Single integration" assumption; multi-connection would require a `connection_label` and per-call routing rules. Recommendation: start with `@@unique([account_id, provider])`; relax in v0.4+ if needed. | 31A |
| **Q3** | `conversations.status` — what are the valid values? Sketch: `open`, `archived`, `blocked`, `spam`. Is `blocked` per-conversation or per-`Contact`? Does `spam` mirror the Call spam state? | No existing enum. The set above is a draft; needs product confirmation. | 31A |
| **Q4** | `sms_messages` — Prisma `@@unique` on nullable column behavior. `provider_message_id` is nullable (no `MessageSid` for manual entries), and Postgres lets multiple NULLs coexist in a unique index. Do we want that, or should we use a partial index (Prisma supports via `@@unique` with no nulls allowed in newer versions) or split into a separate `sms_message_provider_ids` table? | Simplest is "nullable + Postgres allows multiple NULLs" which gives idempotency on real provider ids and accepts duplicate manual entries (harmless). Recommendation: accept that. | 31A |
| **Q5** | `call_segments` — store every partial transcript, or only finalized turns? `RESPONSEOS_EVENT_SCHEMA.md` §9 OQ1 explicitly flags this; backend spec leans Redis-only-for-partials, ledger-for-finals. Need a definitive call here so the model design is right. | If partials, volume could be 10–100x larger; need partitioning strategy. If finals only, much smaller; matches current EVENT_SCHEMA §1 catalog. **Recommendation: finals only** (matches BACKEND_SPEC §3 "finalized turns optionally ledgered" + the EVENT_SCHEMA bias). | 31B |
| **Q6** | `call_transcripts.inline_text` — is the inline String column acceptable as v0.2 substrate, with object-storage (`raw_ref`/`redacted_ref`) wired in v0.3? Or should the model land *without* `inline_text` to force the object-storage path from day one? | Inline-first is what the existing `Call.transcript` already does; pulling it out into `call_transcripts.inline_text` is a cleaner separation without taking on object-storage scope. **Recommendation: ship with `inline_text`; mark `raw_ref`/`redacted_ref` as planning-only in v0.2.** | 31B |
| **Q7** | `call_transcripts.raw_ref` access — what role gates raw-transcript reads? `RESPONSEOS_DATA_MODEL.md` §6 says "`aj_admin` with break-glass only". Where does the break-glass record get written — `audit_logs` (using the new `category: "break_glass"` field from §4)? | Recommendation: yes — every raw-transcript read goes through a `lib/data/callTranscripts.ts` accessor that writes an `audit_logs` row with `category: "break_glass"` *before* returning the artifact. Means 31D (AuditLog expansion) should land *before* 31B's raw-read accessor goes live. Two options: (a) reorder PR sequence so 31D lands before 31B, or (b) ship 31B without the raw-read accessor and add it after 31D. **Recommendation: option (b)** — 31B's raw-read accessor is deferred behind 31D, keeping the PR ordering clean. | 31B + 31D |
| **Q8** | `call_transcripts` migration vs existing `Call.transcript` — leave `Call.transcript` alone in v0.2 (both columns coexist) or deprecate it in 31B? | Leave alone in v0.2 to keep mock-parity tests stable. Deprecation is a separate operator-decided step. **Recommendation: leave alone.** | 31B |
| **Q9** | `qa_logs.rubric_version` — string-only ("v1", "v2"), or eventually a FK into a future `qa_rubrics` table? | String-only is forward-compatible. **Recommendation: ship as `String` in v0.2; promote to FK later if a rubrics table appears.** | 31B |
| **Q10** | `qa_logs` — allow multiple QA reviews per call per rubric_version, or `@@unique([call_id, rubric_version])`? | Allowing multiples (no unique) supports re-review workflows and matches "latest wins" semantics. **Recommendation: no unique; order by `reviewed_at desc`.** | 31B |
| **Q11** | `workflow_runs.workflow_id` — String (workflow name) or FK to a `workflows` table? | n8n workflow definitions live in n8n, not ResponseOS; ADR-0017 explicitly says workflow definitions are versioned in Git, upstream of n8n. **Recommendation: ship as `String` workflow-name label; never introduce a `workflows` table in ResponseOS.** | 31C |
| **Q12** | `workflow_runs.provider` enum vs reuse of existing `WorkflowProvider` enum on `Automation` | The existing `WorkflowProvider` enum has values `n8n`, `make`, `internal` — same set we'd want here. **Recommendation: reuse `WorkflowProvider`; do not duplicate.** | 31C |
| **Q13** | `audit_logs` immutability — DB-level enforcement (revoke `UPDATE`/`DELETE` grants from the app role) or app-level discipline only? | DB-level enforcement is infra work (different role definitions in the Postgres setup). App-level is what we have today. **Recommendation: app-level only in v0.2; file a follow-up for DB-level enforcement when production deploys land in v0.3.** | 31D |
| **Q14** | `audit_logs.category` enum — final value set? Sketch: `routine`, `break_glass`, `export`, `config_change`, `prompt_change`, `policy_change`, `connection_change`. Anything missing or excess? | EVENT_SCHEMA §7 mentions break-glass and prompt/profile changes; SECURITY.md mentions data exports. The seven proposed cover known cases. | 31D |
| **Q15** | Should the new tables be added to `tests/integration/setup.ts` `TABLES` truncation list *before* the migration ships, or as part of the implementation PR? | They cannot truncate a table that doesn't exist. **Must be in the same PR as the migration** (a `Cannot drop table` would otherwise break the test suite). | 31A–D |
| **Q16** | Cardinality / partitioning — at expected v0.3 demo volumes (low) no partitioning needed; at production scale `events`, `sms_messages`, `call_segments` grow fast. Should partitioning be specified now or deferred? | Defer. Schema is forward-compatible with later `CREATE TABLE ... PARTITION BY RANGE (created_at)` rewrites; no v0.2 traffic warrants the complexity. | All — non-blocking |

---

## 7. Non-Goals

Confirmed explicitly per the operator authorization for step 2.3:

| Excluded surface | Confirmation |
|---|---|
| **Auth work** | No Clerk wiring (ADR-0005 step 2.4 territory); no session-derivation changes. The only place this PR set touches auth is reading the existing session for tenant scoping (already in place). |
| **Deploy work** | No Vercel / Neon / proxy / runbook changes. PR #14 stays draft per ADR-0019. |
| **UI rebuild** | No new pages, no DESIGN.md token alignment, no client portal SMS view, no QA review UI. Step 2.5 territory. |
| **Seed idempotency cleanup** | The `update: {}` convention on every upsert (issue #26) stays unchanged. New seeded rows for the new models follow the same convention. |
| **v0.3 demo deploy work** | Out of scope until ADR-0019 § "Once steps 2.1–2.5 land on `master`, the v0.3 demo deploy is unlocked." |
| **`events` ledger table** | The full event ledger is not in step 2.3 scope. The substrate tables (`call_segments`, `call_transcripts`, `workflow_runs`, expanded `audit_logs`) are designed to be **forward-compatible** with the ledger — they hold normalized facts that will derive from ledger events when the ledger ships in a later step. |
| **Object storage integration** | No R2/S3 wiring. `call_transcripts.raw_ref`/`redacted_ref` are nullable string columns; no upload/download endpoints. |
| **Live Twilio/HubSpot/n8n integrations** | No webhook handlers wired. Substrate ships now; consumers in v0.3. |
| **Doc sweeps unrelated to the contract** | No PRD/brand/pricing/marketing sweeps. The active-schema/API doc set is the only doc surface implementation PRs touch (matching #29/#30 discipline). |
| **Opportunistic refactors** | None. |

---

## 8. Next Gate

This plan is **draft + advisory**. No implementation PR opens without explicit operator authorization.

**Required approval before 31A begins:**

1. Operator confirms the **four-PR split recommendation** in §5, OR specifies an alternative split.
2. Operator resolves the **15 open questions** in §6 (or batches them per-PR — Q1, Q2, Q3, Q4 before 31A; Q5–Q8 before 31B; Q9, Q10 before 31B; Q11, Q12 before 31C; Q13, Q14 before 31D; Q15, Q16 standing).
3. Operator confirms the **non-goals** in §7 still hold.
4. Operator authorizes 31A specifically with a per-PR scope checklist (matching the #29 / #30 / step-2.1 / step-2.2 pattern).

Once those four are recorded, the 31A implementation PR opens as a fresh scoped branch off the then-current `master`, follows the established posture (draft until CI green, concise scope summary, migration notes proving additive-only, test evidence, explicit "no auth/deploy/UI" checklist), and merges per the merge-condition pattern already used for #29 and #30.

---

*ResponseOS v0.2 closeout step 2.3 planning artifact — AJ Digital LLC / Audio Jones. Documentation phase only.*
