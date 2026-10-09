# FRL website intake receipts

Status: local foundation with a signed synthetic website connection under
[ADR-0067](frl-signed-test-ingress.md). Not hosted; live delivery stays blocked.

`persistFrlWebIntake` is an authenticated, account-bound data-layer operation.
It validates a strict, versioned FRL payload and persists a blocked receipt and
audit event in one PostgreSQL transaction. The existing Account row is locked
before identity lookup and creation, serializing concurrent submissions.

Replay scope is account, environment and UUID submission ID. Parsed JSON key
order is stable; the digest detects changed-payload conflict. A replay returns
the existing reference without another audit event or downstream effect. The
digest is SHA-256, matching existing assessment intake; it is not anonymization
or a capability. Caller input cannot select the tenant: the authenticated session
must contain an account, including for administrators and operators.

All supported FRL professional and homeowner fields remain structured; no audit
assessment business name is invented. Upstream source-page registry filtering
remains a website obligation. Campaign attribution and cookies are excluded from
this version; activation requires an explicit mapping/version agreement.

## Safety boundary

Migration 0017 adds a separate table in existing ResponseOS Postgres; it does not
introduce another database. Numbers 0014-0016 are reserved by unmerged operational
branches. Delivery is constrained to `blocked` in SQL and code. No worker, claim,
dispatch, HubSpot request, marketing action, public ingress or enable flag exists.
This is a durable receipt prerequisite, not the full retry coordinator adapter.
The subsequent [mock delivery state increment](frl-mock-delivery-state.md) adds
test-only outbox claims and settlement; the live-delivery statements here remain true.
An authorized session/database is mandatory and there is no mock success fallback.

Payload expiry is 90 days. The explicit session-scoped purge operation nulls only
expired blocked payloads and records an audit event. No scheduler or automatic
deletion is added. Reference, identity, hash and receipt survive purge so expiry
cannot allow a replay to dispatch again. Retention for those surviving metadata
requires operator approval before hosted use. Purged replay acknowledges the old
receipt, not a newly actionable inquiry. Deliberate new inquiry requires a new ID.

Prefer code rollback retaining the additive table and receipt history. Do not
drop a populated table. Future dispatch must exclude purged/expired rows and
add reviewed fencing, uncertainty, reconciliation and notification outbox states.
Only then can the website coordinator call a real `IntakeLedger` adapter.

## Architecture review (doctrine section 21)

1. Operational memory/data layer.
2. Built locally; hosted integration deferred.
3. Preserves website inquiries through response loss.
4. Transactional receipt and audit evidence.
5. Enables future verified delivery; claims none now.
6. No proprietary-learning expansion.
7. Reuses existing commodity Postgres.
8. No duplicate CRM, telecom, FSM or scheduling system.
9. Provider-independent receipt schema.
10. Session tenant, scoped queries and Account foreign key.
11. Stable submission identity reduces ambiguity; no analytics change.
12. No public delivered/production-ready claim.
13. Existing migration, commissioning, retention and activation approvals remain.
14. Stored contact payload creates retention/access obligations; no medical data
    requested and no compliance certification claimed.
15. Needed for the observed FRL retry gap, not speculative expansion.

## Remaining acceptance

Authenticated server ingress with tenant/environment binding; private retention
and access review; durable dispatch/settlement/reconciliation and notice queue;
client stable IDs; new-contact and live retry readback; migration parity/rollback
review, CI and hosted acceptance. G02-G04, acquisition, Production storage,
public capture, telephony, cutover and indexing remain gated.
