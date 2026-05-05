# API Spec

All routes live under `app/api/*` as Next.js App Router Route Handlers. Responses use a consistent envelope. v0.1 returns mock data; v0.3 wires real provider/DB reads.

## Response envelope (canonical)

Success:
```json
{ "ok": true, "data": {} }
```

Error:
```json
{ "ok": false, "error": { "code": "STRING_CODE", "message": "...", "details": {} } }
```

`details` is optional and may include vendor-context fields like `retry_after_seconds`, `request_id`, or per-field validation breakdowns. Common `code` values:

| code | When |
|---|---|
| `INVALID_JSON` | Body could not be parsed |
| `VALIDATION_FAILED` | Body parsed but failed schema |
| `NOT_FOUND` | Resource does not exist |
| `METHOD_NOT_ALLOWED` | Wrong HTTP verb |
| `RATE_LIMITED` | Per-tenant or per-key limit hit |
| `IDEMPOTENCY_CONFLICT` | Same key, different body |
| `SIGNATURE_INVALID` | Webhook signature failed |
| `TENANT_SCOPE_DENIED` | Cross-tenant access blocked |
| `VENDOR_UNAVAILABLE` | Upstream provider is down |

v0.1 stubs include a `mock: true` flag inside the success envelope (`{ ok: true, mock: true, data }`) so consumers can tell test data from real. v0.2+ drops the flag once real provider/DB reads are wired.

## Status codes

| Status | Meaning |
|---|---|
| 200 | OK |
| 201 | Created |
| 202 | Accepted (queued) |
| 400 | Malformed payload |
| 401 | Bad auth or invalid signature |
| 403 | Tenant or scope mismatch |
| 404 | Not found |
| 405 | Method not allowed |
| 409 | Idempotency conflict / stale state |
| 422 | Validation failed |
| 429 | Rate limited |
| 500 | Unexpected server error |
| 503 | Vendor dependency unavailable |

## REST routes

### Health
`GET /api/health` → `{ status: 'ok', service: 'responseos', version: '0.1.0' }`

### Calls
- `GET /api/calls` → list of mock calls
- `GET /api/calls/:id` → single call

### Leads
- `GET /api/leads` → list of mock lead events
- `GET /api/leads/:id` → single lead event
- `POST /api/leads/:id/qualify` — body: `LeadQualificationInput` → `{ lead_event_id, qualification_score }`
- `POST /api/leads/:id/status` — body: `{ status: LeadEventStatus, notes? }`

### Bookings
- `GET /api/bookings` → list
- `GET /api/bookings/:id` → single
- `POST /api/bookings/sync/google` — stub for Google Calendar sync
- `POST /api/bookings/sync/calcom` — stub for Cal.com sync

### Quotes
- `GET /api/quotes` → list
- `GET /api/quotes/:id` → single

### Automations
- `GET /api/automations` → list
- `GET /api/automations/:id` → single
- `POST /api/automations/webhook/n8n` — n8n callback into ResponseOS

### Contacts
- `GET /api/contacts`
- `GET /api/contacts/:id`

### Organizations
- `GET /api/organizations`
- `GET /api/organizations/:id`

### Auth
- `GET /api/auth/session` — Clerk session lookup (stubbed; returns unauthenticated)

### Notifications
- `GET /api/notifications`
- `POST /api/notifications/send` — body: `{ channel, recipient, subject?, message }`

### Reports
- `GET /api/reports/revenue` → current period revenue_metrics
- `GET /api/reports/client/:organizationId` → metrics list for one workspace

## Webhook routes

All webhook endpoints accept POST only (405 on other methods), parse JSON safely, and return `{ ok: true, received: <provider>, mock: true }`. Each has a TODO marker for signature verification.

| Route | Provider | Signature header (v0.3) |
|---|---|---|
| `POST /api/webhooks/twilio/call-status` | Twilio voice | `X-Twilio-Signature` |
| `POST /api/webhooks/twilio/sms` | Twilio messaging | `X-Twilio-Signature` |
| `POST /api/webhooks/retell/call-ended` | Retell AI | `x-retell-signature` (raw body, 5-min freshness) |
| `POST /api/webhooks/vapi/call-ended` | Vapi | provider header, TBD |
| `POST /api/webhooks/n8n` | n8n | shared secret via `N8N_WEBHOOK_SECRET` |
| `POST /api/webhooks/stripe` | Stripe | `Stripe-Signature` (constructEvent + timestamp) |
| `POST /api/webhooks/ghl` | HighLevel | `X-GHL-Signature` (legacy `X-WH-Signature` deprecates 2026-07-01) |

## Rate limits (v0.2+)

Public AJ API stays simple; tenant-aware limits apply internally.

| Surface | Limit | Notes |
|---|---|---|
| Public REST API | 120 req/min/key | soft burst 30 in 10s |
| Quote generation | 20 creates/min/tenant | queue excess with `202 Accepted` |
| Appointment booking | 10 concurrent holds/tenant | prevent oversubscription |
| Report endpoints | 30 req/min/user | cache heavily |
| Webhook endpoints | no user-facing limit | dedupe by provider event key; reject invalid signatures |

## Idempotency rules

All POST mutation endpoints accept an `Idempotency-Key` header; keys are retained for **24 hours**. A repeated key with a matching body returns the original response; a repeated key with a different body returns `409 Conflict` (`code: IDEMPOTENCY_CONFLICT`).

Provider-specific dedupe rules — these apply before any business mutation lands:

| Surface | Dedupe rule |
|---|---|
| All vendor webhooks | Provider event ID (e.g. Twilio `MessageSid`/`CallSid`, Retell `call_id`, Stripe `event.id`, GHL `event.id`) stored in the event ledger before processing. Replays are no-ops. |
| Twilio call events | Per `CallSid` — duplicate `call-status` callbacks must not create duplicate `Call` rows or duplicate `LeadEvent` rows. |
| Twilio SMS events | Per `MessageSid` — duplicates collapse to a single conversation entry; replies match to existing contact + conversation by `From` number + tenant. |
| Stripe webhooks | Use Stripe-recommended `Idempotency-Key` on charge/refund creation; webhook ingest dedupes on `event.id`. |
| n8n callbacks | Body must include `workflowRunId`; same `workflowRunId` is a replay, not a new run. |
| Internal POSTs | `Idempotency-Key` header (24h retention). |

These rules go live progressively: v0.1 returns mock acks; v0.2 adds the persistence layer and dedupe hashes; v0.3 enforces signature validation alongside dedupe.

## Webhook ingest contract

Vendor webhooks must land in the event ledger (v0.2 `events` table) **before** mutating any business object. The dedupe key combines `provider` + the provider-supplied event id (e.g. Twilio `MessageSid`, Retell `call_id`, Stripe `event.id`). Replays are safe because mutations are derived from the ledger, not from the inbound HTTP request.

## Sample payloads (v0.2 target shapes)

### Quote creation
```http
POST /v1/quotes
{
  "account_id": "acct_aj_roofing_01",
  "lead_id": "lead_01JXYZ",
  "service_type": "roof_repair",
  "site_address": { "line1": "123 Palm Ave", "city": "Miami", "state": "FL", "postal_code": "33101" },
  "line_items": [{ "code": "ROOF_REPAIR_MINOR", "name": "Minor roof repair", "qty": 1, "unit_price": 65000 }],
  "notes": "Leak near vent stack; customer requests Friday visit",
  "currency": "USD"
}
```

```http
201 Created
{
  "id": "quote_01JXYZ",
  "status": "draft",
  "grand_total": 65000,
  "approval_url": "https://recover.ajdigital.com/q/quote_01JXYZ",
  "self_schedule_eligible": true
}
```

### Appointment availability
```http
POST /v1/appointments/availability
{
  "account_id": "acct_aj_roofing_01",
  "lead_id": "lead_01JXYZ",
  "service_duration_minutes": 120,
  "window_start": "2026-05-06T00:00:00-04:00",
  "window_end": "2026-05-10T23:59:59-04:00"
}
```

```http
200 OK
{ "slots": [
  { "start": "2026-05-07T09:00:00-04:00", "end": "2026-05-07T11:00:00-04:00" },
  { "start": "2026-05-08T13:00:00-04:00", "end": "2026-05-08T15:00:00-04:00" }
]}
```
