# ResponseOS GTM and prospect-demo closure

**Status:** Repository implementation in review. External activation gates remain closed.

## Problem

The carrier and CRM factories previously produced mocks only, so adding keys could not prove a live prospect journey. The public intake also acknowledged submissions without durable, replay-safe persistence.

## Desired outcome

Prove an inbound, supervised demonstration in which Telnyx AI Assistant owns the conversation; ResponseOS verifies, ledgers, normalizes, persists, and displays the evidence; and a controlled HubSpot developer account receives only the bounded commercial follow-up record.

## Success criteria

- One signed Telnyx event stream produces one tenant-scoped canonical call with transcript, summary, qualification, and next action.
- One finalized qualified call produces at most one HubSpot contact, call activity, and follow-up task; ambiguous contacts require review.
- Invalid/stale signatures produce no mutation; retries and out-of-order delivery do not duplicate canonical or provider effects.
- Full transcripts and recordings are not exported to HubSpot; recording is disabled.
- Public audit requests are idempotently persisted and move through `received → reviewed → qualified/rejected` with audited changes and 90-day unqualified-PII expiry.
- Authenticated operators can inspect call evidence and retry a durable CRM failure.
- Mock staging and live demo remain isolated from the existing production project and deploy only an exact reviewed SHA.

## In scope

- Fictional persisted sandbox plus safe static fallback.
- Signed Telnyx post-call events and ledger-first normalization.
- Explicitly gated HubSpot developer-test adapter.
- Hidden live-call page and authenticated operator evidence surface.
- Repository workflows, environment preflights, tests, and runbook.

## Out of scope

Realtime audio control, outbound dialing, scheduling, recording, deal creation, Vapi, Sent.dm, Twilio failover, Calendly, Stripe, production deployment, real client data, unattended public availability, and prospect release.

## Constraints and risks

- Server code owns all tenant identifiers and the authorized demo number.
- Secret presence never activates Telnyx ingest or HubSpot execution.
- Cross-system exactly-once behavior requires durable provider IDs plus reconciliation searches before retry creation.
- A green local build is not live-provider evidence. HubSpot mappings must be verified in the developer test account; WAF must produce an observed `429`; private calls, failure drills, rollback, and one outside-number rehearsal remain mandatory.

## Implementation sequence

1. Merge the database/intake/demo foundation through normal review and CI.
2. Clear mock-only staging with no provider credentials.
3. Provision isolated live-demo resources and inject environment-scoped values under separate authorization.
4. Run private signed-event and HubSpot mapping tests with visibility disabled.
5. Complete failure drills, rollback, and one outside-number rehearsal.
6. Record a human go/no-go before exposing `+17867560897` to a prospect.
