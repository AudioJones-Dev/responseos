# FRL qualified-call handoff

Status: repository implementation for review, with mock-provider evidence only.
Live delivery, tenant activation and production acceptance remain pending.

The operator's 2026-10-06 instruction is: answer inbound calls 24/7, qualify and
capture the caller, retain the interaction in CRM, and notify the configured
human owner only when qualified. Answering hours do not promise human callback
hours. The receptionist does not quote, sell, book or create opportunities.

## Implemented boundary

1. Existing raw-signature verification and temporal destination resolution run
   before normalization. No new number routing or provider configuration exists.
2. A finalized inbound call uses the existing contact/call-activity CRM adapter.
   Maybe, unqualified and spam calls still retain CRM capture; none receives a
   qualified handoff task or notification.
3. The explicitly bound FRL account skips the old unowned generic task. Its
   qualified handoff separately requires successful contact and activity sync.
4. The server reads a pinned, approved, unrevoked tenant memory snapshot,
   verifies its hash and account, and validates one `policy.qualified_handoff`
   fact. A demo-only fact cannot authorize this path.
5. A durable atomic claim creates/reconciles a HIGH task assigned to the
   configured HubSpot owner. The HubSpot path reads the owner back before
   queuing a notification. Existing task IDs survive partial failure.
6. Notification upsert and handoff state commit in one database transaction.
   The account/call key prevents duplicate outbox entries. The entry remains
   `queued`, `sent_at` remains null, and the response says `deliveryStatus:
   "not_sent"`. **There is no email/SMS delivery adapter or dispatcher in this
   increment. Queueing is not notification delivery or operational acceptance.**

`qualification_status === "qualified"` remains the eligibility authority. No
score cutoff, outcome allowlist, county coverage or confidence threshold is
invented here. Approval of those business rules remains separate. Source page,
UTM and referrer attribution cannot be reconstructed from a static telephone
number; the record includes only existing call/lead context.

## Configuration contract

All three server-only environment settings are unset/false by default:

```text
RESPONSEOS_FRL_QUALIFIED_HANDOFF_ENABLED=false
RESPONSEOS_FRL_HANDOFF_ACCOUNT_ID=
RESPONSEOS_FRL_HANDOFF_SNAPSHOT_ID=
```

The approved snapshot must contain exactly one policy fact with this shape:

```typescript
{
  crmOwnerId: string; // HubSpot numeric owner ID, not a name or user ID
  crmContactBaseUrl: string; // verified HTTPS HubSpot contact-record base URL
  notification:
    | { channel: "email"; recipient: string }
    | { channel: "sms"; recipient: string }; // E.164
}
```

The URL must be on `app.hubspot.com` or `app-eu1.hubspot.com` and use
`/contacts/{portalId}/record/0-1/`, without credentials, query or fragment.
Actual recipient, owner ID and portal identity are client operational data:
they belong in the existing approved snapshot/configuration process, never in
source, seeds, tests, PR descriptions or public bundles. No operating facts are
added to the FRL skeleton by this work. This increment adds no configuration
write or approval endpoint.

Task `hs_timestamp` is the handoff's creation time, making the item immediately
visible in the human queue. It is **not** a callback deadline. The message
explicitly says the human callback SLA is not configured. A staffed-hours SLA
must be approved before any automated callback promise.
HubSpot documents both the required task timestamp and owner-ID property in its
[task API guide](https://developers.hubspot.com/docs/api-reference/legacy/crm/activities/tasks/guide).

## Human message

The private outbox includes captured name, validated callback number, verified
email if available, service, captured city, existing service-area confirmation,
requested timeframe, property type, retained classification, sanitized summary,
next action and CRM contact/activity/task references. Unknown fields say “Not
captured”; no city or service facts are inferred. No transcript or recording
URL is attached. Existing CRM text sanitization redacts phone/email mentions;
it is not a general medical-information or sensitive-content classifier.

## Inspection and recovery

- `GET /api/admin/qualified-handoffs` returns the bound account's status,
  provider, task/notification IDs and redacted error code; it exposes no message
  or recipient. AJ admin/operator role is required.
- `POST /api/admin/qualified-handoffs/{callId}/retry` rechecks CRM capture,
  classification and approved configuration under the server-owned account.
  It does not accept a client-provided account, owner or recipient.
- Missing/revoked configuration, wrong provider or owner, or changed pinned
  configuration results in `review_required` with no new notification.
- Provider/queue failure is `retryable_failed`; manual retry reuses persisted
  IDs and searches the distinct handoff task evidence key before creation.
- A worker lost while `processing` requires operator reconciliation of provider
  evidence before a reset. There is no lease recovery/background retry worker.
- A later qualification change or revoked policy must be checked again by a
  future dispatcher before sending any queued entry. This increment sends none.

The existing `/api/notifications/send` mock endpoint is unchanged and is not a
live transport. No generic workflow engine, Deal, Ticket, Note, outbound caller
message, marketing enrollment or opportunity event is added.

## Remaining operational acceptance

1. Confirm the recipient/channel, CRM owner ID and CRM contact-record base URL
   privately, and approve the tenant snapshot/configuration.
2. Choose and implement the authorized operational delivery transport with
   provider idempotency, delivery evidence, retry and protected recipient rules.
   Email/SMS selection above is an outbox contract, not transport readiness.
3. Resolve existing recording/transcript consent gates and human callback policy.
   This change does not fix or activate the historical capture/consent path.
4. With separate authorization, verify the production-candidate chain: website
   CTA → AI answer → authorized interaction capture → classification → CRM
   contact/activity → owned task → delivered notification → visible human
   ownership. Verify incomplete/unqualified calls produce no owner lead alert.
5. Keep website `phone_click`, backend call completion, qualification, queueing,
   delivery and opportunity creation distinct. This code emits no GA4/GTM event
   and no `generate_lead` or `opportunity_created` event.

L04, L13 and L14 remain open until that controlled operational test succeeds.
There are no live calls, leads, messages, migrations, deployments, CMS writes,
DNS changes or indexing changes in this implementation session.

## Doctrine §21 review

| Question | Answer |
|---|---|
| 1. Layer | Canonical communications evidence and bounded CRM/operational handoff. |
| 2. Build/integrate/defer | Build qualification gate/outbox; extend existing CRM adapter; defer delivery transport. |
| 3. Pilot path | Makes the qualified owner action reviewable; does not activate the pilot. |
| 4. Evidence | Call/activity IDs, snapshot/hash, task ID and durable queue state are retained. |
| 5. Verified outcomes | Separates queued from delivered; makes no opportunity/revenue claim. |
| 6. Learning | Preserves structured operational evidence; no proprietary-learning claim. |
| 7. Commodity buy | Use an approved provider for email/SMS delivery; do not build a messaging service. |
| 8. Duplicate platforms | No CRM, FSM, carrier or general workflow engine is introduced. |
| 9. Vendor lock-in | CRM semantics remain behind the current adapter; no provider-independence claim. |
| 10. Tenant isolation | Signed destination binding, tenant-filtered reads/writes and operator-only inspection/retry. |
| 11. Attribution | No inferred website-to-call identity, completed-call proof from clicks or duplicate lead signal. |
| 12. Public claims | Implementation/mocks only; no production-ready or delivered-notification claim. |
| 13. Approval | Existing snapshot approval and separate activation/delivery authorization remain required. |
| 14. Compliance | Private contact details in a protected queue; no new recording, transcript export or analytics PII. |
| 15. Needed now | Directly implements the operator's qualified-only ownership requirement. |
