# ResponseOS — API Contracts

**Owner:** AJ Digital LLC / Audio Jones
**Status:** Canonical (go-forward). Extends [`../api-spec.md`](../api-spec.md) — the envelope, status codes, error codes, and idempotency rules there are inherited verbatim; this doc adds the go-forward routes (voice gateway, tenant provisioning, profiles, HubSpot) and the internal gateway↔core contract.
**Read first:** [`RESPONSEOS_EVENT_SCHEMA.md`](./RESPONSEOS_EVENT_SCHEMA.md) · [`RESPONSEOS_SYSTEM_ARCHITECTURE.md`](./RESPONSEOS_SYSTEM_ARCHITECTURE.md)

---

## 1. Inherited contract (from `../api-spec.md`)

- **Success envelope:** `{ "ok": true, "data": {} }`. **Error envelope:** `{ "ok": false, "error": { "code", "message", "details?" } }`.
- **Error codes:** `INVALID_JSON`, `VALIDATION_FAILED`, `NOT_FOUND`, `METHOD_NOT_ALLOWED`, `RATE_LIMITED`, `IDEMPOTENCY_CONFLICT`, `SIGNATURE_INVALID`, `TENANT_SCOPE_DENIED`, `VENDOR_UNAVAILABLE`.
- **Status codes:** 200/201/202/400/401/403/404/405/409/422/429/500/503 as specified in `../api-spec.md`.
- **Idempotency:** `Idempotency-Key` on all POST mutations, 24h retention; replay = original response; same key + different body = 409.
- **All routes** are Next.js App Router Route Handlers under `app/api/*` except the realtime media socket (owned by the voice gateway, §4).

All new routes below use this same envelope and rules.

---

## 2. Authentication & tenant scoping

| Caller | Auth | Tenant scope |
|---|---|---|
| Browser (console/portal) | Session cookie (Auth provider) | `organization_id` derived from session |
| Public/partner REST | API key (per tenant) | key → `organization_id` |
| Provider webhooks | Signature validation (ADR-0009) | route/connection → `organization_id` |
| Gateway ↔ core (internal) | mTLS or signed service token | `organization_id` in the signed event payload |

**Rule:** `organization_id` is never read from a client-supplied body or query param. A mismatch → `403 TENANT_SCOPE_DENIED`.

---

## 3. REST routes (go-forward additions)

Existing routes (`/api/calls`, `/api/leads`, `/api/bookings`, `/api/quotes`, `/api/automations`, `/api/contacts`, `/api/organizations`, `/api/notifications`, `/api/reports/*`, `/api/health`, `/api/auth/session`) are retained per `../api-spec.md`. Additions:

### Tenant provisioning & config (operator / `aj_admin`)
| Method | Route | Purpose |
|---|---|---|
| POST | `/api/admin/tenants` | Provision a tenant (data-only; no code change) |
| GET | `/api/admin/tenants/:id` | Tenant detail |
| POST | `/api/admin/tenants/:id/offboard` | Start tenant offboarding (export + delete workflow) |
| GET/PUT | `/api/admin/tenants/:id/profiles/routing` | Routing profile (versioned) |
| GET/PUT | `/api/admin/tenants/:id/profiles/prompt` | Prompt profile (versioned) |
| GET/PUT | `/api/admin/tenants/:id/profiles/policy` | Policy profile (versioned) |
| GET/PUT | `/api/admin/tenants/:id/profiles/workflow` | Workflow profile (versioned) |

> Profile PUTs create a new **version** (immutable history) and require a reason for audit. `409` if the supplied `base_version` is stale (optimistic concurrency).

### Integrations / connections (tenant `client_admin`)
| Method | Route | Purpose |
|---|---|---|
| GET | `/api/integrations` | List the tenant's connections + status |
| POST | `/api/integrations/hubspot/connect` | Begin HubSpot OAuth |
| GET | `/api/integrations/hubspot/callback` | OAuth callback → store encrypted tokens |
| POST | `/api/integrations/calendar/connect` | Begin Google/Cal.com OAuth |
| POST | `/api/integrations/:provider/disconnect` | Revoke + mark disconnected |
| POST | `/api/integrations/:provider/test` | Verify connection (`last_verified_at`) |

### Calls / sessions / transcripts (read; tenant-scoped)
| Method | Route | Purpose |
|---|---|---|
| GET | `/api/calls/:id/session` | Realtime session detail (provider, failover, durations) |
| GET | `/api/calls/:id/transcript` | Redacted transcript (raw only via break-glass) |
| POST | `/api/calls/:id/qa` | Submit a QA review (`qa_logs`) |

### Reports
| Method | Route | Purpose |
|---|---|---|
| GET | `/api/reports/revenue` | Current-period metrics (existing) |
| GET | `/api/reports/client/:organizationId` | Per-workspace metrics (existing) |
| POST | `/api/reports/generate` | Trigger monthly report generation (idempotent per period) |

---

## 4. Voice gateway: realtime + internal contract

The realtime audio loop is owned by the **Node.js voice gateway**, not the Next.js app (ADR-0013). Two surfaces:

### 4.1 Realtime media (gateway ↔ Twilio)
- Twilio **Media Streams** WebSocket → gateway. Not a REST route; a persistent socket per call.
- Gateway opens a provider session (Grok primary, OpenAI fallback) via the voice provider interface (`startSession`, `streamAudio`, `onPartialTranscript`, `onToolCall`, `onTurnComplete`, `endSession`).

### 4.2 Gateway ↔ core (internal API)
Internal, service-authenticated (mTLS/signed token), tenant-scoped via signed payload.

| Method | Route | Direction | Purpose |
|---|---|---|---|
| POST | `/internal/events` | gateway → core | Emit normalized events into the ledger (batch-capable) |
| POST | `/internal/tools/:name` | gateway → core | Execute a tool call (`check_availability`, `create_quote`, `lookup_contact`, `escalate_to_human`) |
| GET | `/internal/tenants/:id/profiles` | gateway → core | Fetch active prompt/policy/routing profile versions at session start |

Tool execution contract (example):
```http
POST /internal/tools/check_availability
{ "organization_id": "acct_...", "session_id": "sess_...",
  "service_duration_minutes": 120, "window_start": "...", "window_end": "..." }
-> 200 { "ok": true, "data": { "slots": [ { "start": "...", "end": "..." } ] } }
```
Every tool call emits `tool.invoked` + `tool.result` to the ledger (§ Event Schema). Failover and tool failures degrade the call gracefully (policy-engine-driven), never crash the session.

---

## 5. Webhook routes (go-forward)

All webhooks: POST only (405 otherwise), signature-validated **before** body parse and **before** any business mutation (ADR-0009), land in the ledger first.

| Route | Provider | Signature | Dedupe key |
|---|---|---|---|
| `POST /api/webhooks/twilio/call-status` | Twilio voice | `X-Twilio-Signature` (HMAC-SHA1, full URL + sorted params, raw body) | `twilio:<CallSid>` |
| `POST /api/webhooks/twilio/sms` | Twilio SMS | `X-Twilio-Signature` | `twilio:<MessageSid>` |
| `POST /api/webhooks/voice/grok` | Grok Voice (xAI) | provider HMAC / raw-body, freshness window | `grok:<session_id>` |
| `POST /api/webhooks/voice/openai` | OpenAI Realtime | provider signature scheme | `openai:<session_id>` |
| `POST /api/webhooks/hubspot` | HubSpot | HubSpot v3 signature (client secret + method + URI + body) | `hubspot:<eventId>` |
| `POST /api/webhooks/n8n` | n8n | shared secret header, constant-time vs `N8N_WEBHOOK_SECRET` | `n8n:<workflowRunId>` |
| `POST /api/webhooks/stripe` | Stripe (v0.5) | `Stripe-Signature` (`constructEvent`) | `stripe:<event.id>` |

> The original spec's `retell`/`vapi` webhook routes remain valid for the optional/future provider lane but are **not** the primary path; Grok/OpenAI are primary (ADR-0012). New voice-provider signature rules are documented in [`../ops/RESPONSEOS_SECURITY_AND_COMPLIANCE.md`](../ops/RESPONSEOS_SECURITY_AND_COMPLIANCE.md) with a passing integration test before go-live.

---

## 6. Rate limits (inherited + additions)

| Surface | Limit | Notes |
|---|---|---|
| Public REST API | 120 req/min/key | soft burst 30/10s (inherited) |
| Quote generation | 20 creates/min/tenant | queue excess `202` |
| Booking | 10 concurrent holds/tenant | prevent oversubscription |
| Report endpoints | 30 req/min/user | cache heavily |
| Internal gateway tool calls | per-tenant concurrency cap = concurrent-call ceiling | protects core during call spikes |
| Webhooks | no user-facing limit | dedupe by event key; reject invalid signatures |

---

## 7. Sample payloads (go-forward target shapes)

### Provision a tenant
```http
POST /api/admin/tenants
{ "name": "AJ Roofing", "slug": "aj-roofing", "industry": "home-services",
  "timezone": "America/New_York", "compliance_lane": "standard" }
-> 201 { "ok": true, "data": { "id": "acct_...", "status": "lead" } }
```

### Connect HubSpot (OAuth start)
```http
POST /api/integrations/hubspot/connect
-> 200 { "ok": true, "data": { "authorize_url": "https://app.hubspot.com/oauth/authorize?..." } }
```

### Quote creation (inherited shape from `../api-spec.md`)
```http
POST /api/quotes
{ "account_id": "acct_aj_roofing_01", "lead_id": "lead_01JXYZ", "service_type": "roof_repair",
  "line_items": [ { "code": "ROOF_REPAIR_MINOR", "name": "Minor roof repair", "qty": 1, "unit_price": 65000 } ],
  "currency": "USD" }
-> 201 { "ok": true, "data": { "id": "quote_01JXYZ", "status": "draft", "grand_total": 65000 } }
```

---

## 8. Versioning & deprecation

- Public REST is versioned by path prefix when breaking changes land (`/v1/...`).
- The internal gateway↔core contract is versioned in lockstep with the gateway deploy.
- Deprecations are announced in [`../CHANGELOG.md`](../CHANGELOG.md) and gated with a migration window.

---

## 9. Assumptions & open questions

**Assumptions:** Grok/OpenAI expose webhook/event signatures we can validate; HubSpot OAuth + webhook signature follow the documented v3 scheme; the internal gateway contract can use mTLS or signed service tokens on the Standard lane.

**Open questions:** (1) public REST surface scope for MVP (likely minimal/internal-only); (2) whether tool calls go gateway→core REST or a lower-latency RPC/gRPC at scale; (3) HubSpot rate-limit handling under burst (queue + backoff vs reject).

---

*ResponseOS API Contracts — AJ Digital LLC / Audio Jones. Documentation phase only.*
