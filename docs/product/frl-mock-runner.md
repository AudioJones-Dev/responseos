# FRL local mock runner

Status: local synthetic validation only. `runFrlMockDelivery` connects the existing
tenant-bound claim and fenced settlement functions. It simulates one outcome per
explicit operator call. It imports no provider SDK, performs no external request,
and takes no arbitrary adapter callback. There is no scheduler or automatic retry.

The existing selected-account role, default-off dispatch flag, test receipt and
non-production runtime checks apply. Only a committed fresh claim can simulate an
outcome. Confirmed replay returns the stored mock receipt without another attempt.
Notification/marketing remain blocked until mock CRM confirmation; marketing also
requires an existing consent-gated intent. An uncertain/rejected/active claim is
returned unchanged. Rejected requeue remains a separate audited operator action.

An explicit scenario (`confirmed`, `rejected`, `uncertain`) selects a synthetic
outcome; it is not provider evidence. Confirmation uses a stable `mock_` operation
reference. Successful settlement says `settlementRecorded=true`. A settlement
failure returns `uncertain` with `settlementRecorded=false`, never confirmation.
The database may still say dispatching until the original lease expires and a
later claim records uncertainty. Neither state authorizes a resend. The receipt's
overall delivery status remains blocked even when mock intents are confirmed.

Integration acceptance covers concurrent runner calls, receipt replay, CRM-first
follow-ups, consent gating, rejection/uncertainty, tenant isolation, Production
refusal and transaction rollback during settlement. Fixtures are synthetic; mock
confirmation closes no live delivery or launch gate.

Doctrine review: 1 delivery/operational memory layer; 2 local built test seam;
3 validates the observed lead recovery path; 4 preserves audit and claim evidence;
5 supports future verification without claiming delivery; 6 no learning expansion;
7 existing Postgres, no new commodity service; 8 no duplicate CRM/telecom/workflow
platform; 9 provider independent; 10 session tenant preserved; 11 stable operation
identity; 12 mock-only status; 13 existing activation gates; 14 synthetic local
data only; 15 completes the existing claim/settle validation, no scheduler added.

Open: reviewed live adapters, durable provider reconciliation, approved recipient
policy, bounded notification retry scheduling, private retention during in-flight
delivery, hosted authentication/database acceptance and controlled live readback.
The website and signed ingress continue to save test receipts without dispatching.
