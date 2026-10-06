# FRL qualified notification delivery

Status: bounded repository implementation for review. Synthetic providers and
local database evidence only; no live email, activation or commissioning.
Depends on draft PR193 / ADR-0059.

## Scope and operating decisions

The operator requested notification transport and evidence as the next critical
path. Email first and a private destination were supplied in the conversation.
The exact HubSpot owner identity remains pending. Actual recipient/owner values
belong only in approved private tenant configuration, never in Git.

Sam's intake is 24/7; the operator specified human callbacks Monday–Friday,
9 a.m.–5 p.m. The proposed 15-minute target, first-30-minutes next-window rule,
timezone confirmation and holidays are not ratified here. No callback scheduler
or changed task deadline is added. Existing task time means queue visibility.

No SMS, caller sequence, booking, quote engine, Deal/opportunity, analytics event,
dependency remediation, automatic hosted job or provider configuration is added.

## Transport evidence

Use the existing designated Resend direction behind an adapter, with no new SDK
or dependency. POST `/emails` fixes the approved ResponseOS system sender, uses
one recipient and plain text, and supplies a stable hashed handoff key. No
CC/BCC, attachments or recording/transcript links are introduced. The prepared
outbox already carries captured context and CRM references; no acquisition
attribution is inferred.

POST success proves **provider acceptance**, not recipient delivery. Later GET
`/emails/:id` must match the message ID, recipient, sender, subject and exact
text, with no CC/BCC, before `last_event=delivered` confirms delivery. Unknown,
opened/clicked and delayed events do not independently certify delivery here.
Bounce/failure/cancellation/suppression/complaint before terminal delivery is
failure; no second email is generated.

`Notification.status=sent` and `sent_at` mean provider acceptance.
`QualifiedNotificationDelivery` retains tenant/call/handoff/outbox correlation,
payload hash, POST attempt count, first attempt, claim/lease, verified task/owner
identity/time, provider message ID/event, acceptance observation, delivery
observation, last check and redacted error. Its status API omits message,
recipient and private owner ID. Observation times do not invent provider event
times or prove Michael read the alert. Counters/current evidence are retained;
an append-only history of every retry response is not implemented.

States: `pending`, `processing`, `accepted`, `delivered`, `retryable_failed`,
`review_required`, `failed`. Delivered and provider-failed are terminal for this
one-alert action; post-delivery lifecycle/complaint monitoring is not included.

## Gates, claims and retry

The worker consumes only a server-bound existing queued qualified handoff with
matching outbox, completed inbound call, qualified lead, successful HubSpot
contact/activity capture, unchanged approved snapshot/hash, email recipient and
owner readback. Mock CRM evidence cannot produce a real email. Qualification,
tenant references, policy, payload and transport posture are checked again
immediately before send. An accepted request cannot be recalled by this worker.

Two-minute leases and compare-and-set claims prevent concurrent dispatch. Payload
hash freezes request identity; changed task/configuration/payload requires
review. A retained provider message ID permits GET only, never another POST.

Resend keeps keys for 24 hours. Uncertain sends, lost responses, failed local
commits and expired leases can reuse the **same request/key** only within 23
hours of the original POST attempt. Older uncertainty becomes
`provider_reconciliation_required`. No endpoint bypasses this bound or resets
the key. Operator provider reconciliation precedes any separately reviewed
recovery. Exactly-once delivery is a provider-supported commissioning goal,
not an unlimited guarantee across crashes and expired evidence.

### Configuration: defaults off

```text
RESPONSEOS_FRL_QUALIFIED_HANDOFF_ENABLED=false
RESPONSEOS_FRL_HANDOFF_ACCOUNT_ID=
RESPONSEOS_FRL_HANDOFF_SNAPSHOT_ID=
RESPONSEOS_FRL_NOTIFICATION_DELIVERY_ENABLED=false
RESPONSEOS_LIVE_RESEND_ENABLED=false
RESEND_API_KEY=
EMAIL_FROM=
```

Recipient/owner remain in the approved, unrevoked `policy.qualified_handoff`
snapshot fact. Live email also requires the flag/key and `EMAIL_FROM` equal to
the approved system sender. Missing configuration resolves mock; dispatch
refuses that mock and preserves the real queue. Test injection is internal,
never request-controlled. Hosted auth must also fail closed under the existing
`RESPONSEOS_REQUIRE_AUTH` gate; hosted/production dispatch and inspection refuse
execution if it is unset, even if the developer session would be privileged.
Installing credentials or enabling flags is not
authorized by this increment.

### Operator surfaces

- `GET /api/admin/qualified-notifications`: latest 100 server-account records,
  metadata only.
- `POST /api/admin/qualified-notifications/dispatch`: up to ten new messages
  and ten eligible retries/polls. Held/terminal records do not starve fresh work.
  No scheduler is installed; an authorized invocation owner/cadence is required.
- `POST /api/admin/qualified-notifications/:callId/retry`: controlled revalidation
  and retry/poll. No account/recipient/owner/key override.

All require AJ admin/operator role. Preparation APIs now report
`deliveryStatus=not_verified`; preparation cannot infer delivery after the
separate worker runs. The delivery API supplies authoritative evidence. Generic
mock `/api/notifications/send` remains unchanged.

## Commissioning runbook

1. Review this increment and PR193; resolve inherited audit/CI failures in a
   separate dependency lane. Keep draft until required gates pass.
2. Confirm exact owner and supplied recipient privately; approve tenant snapshot
   and verify CRM ownership/contact links.
3. Obtain separate authority for credential/provider changes, sender verification
   and controlled production-candidate testing. Confirm hosted auth, permission
   for captured context, consent/retention and dispatcher ownership/cadence.
4. Under that authority, prove one qualified call → contact/activity → correct
   task owner → provider ID/acceptance → delivery → Michael sees captured details
   and follow-up ownership. Inbox delivery alone does not prove human response.
5. Replay/retry: one human-facing alert. Non-qualified calls: retained capture,
   zero lead alerts. Exercise failures and the separate public mailbox fallback.
6. If unresolved, disable delivery and retain outbox/evidence. Reconcile uncertain
   provider outcomes before retry; never force an expired send with a fresh key.

Workstream F remains **prepared**, not commissioned, until the authorized live
chain passes. Callback SLA and downstream sales automation remain separate.

## Doctrine section 21 review

| Question | Answer |
|---|---|
| 1. Layer | Communications dispatch and operational evidence. |
| 2. Build/integrate/defer | Build qualified claims/evidence, integrate adapter-bound email, defer scheduling. |
| 3. Pilot path | Supplies missing alert gate without activation. |
| 4. Evidence | Call/handoff/task/message correlation and owner/delivery readback. |
| 5. Outcomes | Transport facts only; no response or revenue claim. |
| 6. Learning | Operational provenance without an intelligence claim. |
| 7. Commodity | Existing Resend direction; no email infrastructure. |
| 8. Duplication | No CRM, FSM, carrier or generic workflow builder. |
| 9. Lock-in | Adapter boundary and explicit provider retention limit. |
| 10. Isolation | Server tenant binding, scoped references and operator control. |
| 11. Attribution | Retained captured context; no inferred web/call identity. |
| 12. Claims | Synthetic evidence only; no commissioned/live/production-ready claim. |
| 13. Approval | Approved snapshot plus separate provider/activation/test authority. |
| 14. Compliance | No recording/export/marketing change; private alert and existing consent gates. |
| 15. Needed now | Operator's delivered-notification critical path. |

Provider docs read 2026-10-06:
[send](https://resend.com/docs/api-reference/emails/send-email),
[24-hour idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys),
[retrieve](https://resend.com/docs/api-reference/emails/retrieve-email).
No live request or provider configuration write was performed.
