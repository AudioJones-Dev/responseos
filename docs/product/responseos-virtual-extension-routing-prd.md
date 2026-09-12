# PRD — ResponseOS Virtual Extension Routing

**Status:** `EXPERIMENTAL` — Stage 1 contracts and deterministic mocks were
authorized and implemented on 2026-08-20. They are not merged, deployed, or
connected to a runtime consumer. Stages 2–4 remain unauthorized, including
schema changes, provider configuration, credentials, number procurement, live
calls, deployment, and prospect access.
**Owner:** AJ Digital LLC / Audio Jones
**Related:** [`../PRD.md`](../PRD.md), [`../ROADMAP.md`](../ROADMAP.md),
[`../DECISIONS.md`](../DECISIONS.md),
[`responseos-gtm-prospect-demo-closure.md`](./responseos-gtm-prospect-demo-closure.md),
[`responseos-v0.3-live-call-demo-slice.md`](./responseos-v0.3-live-call-demo-slice.md),
[`responseos-communications-stack.md`](./responseos-communications-stack.md),
[`../SECURITY.md`](../SECURITY.md).

## 1. Decision summary

ResponseOS should own provider-neutral virtual-extension semantics and routing
policy. Telnyx, Vapi, or a later provider may execute a call transfer, but no
carrier or voice-agent configuration is the canonical extension directory.

The approved hierarchy is:

```text
Inbound phone number
  -> server-resolved Account
    -> virtual extension or spoken routing intent
      -> versioned routing policy
        -> authorized destination reference
```

This is a follow-on capability to the supervised post-call evidence chain in
ADR-0047. It is not part of that closure, does not make Vapi mandatory for the
bounded Telnyx AI Assistant demo, and does not authorize a PBX replacement.

The smallest future implementation candidate is a separate mock-only slice:

- `101` or spoken "sales" resolves to one synthetic human destination;
- `0` resolves to a deterministic message-taking fallback;
- unknown extensions produce an unresolved event and then fall back safely;
- no live destination, provider SDK, secret, schema migration, or network call.

The operator authorized that Stage 1 slice on 2026-08-20. This repository change
implements only that pure mock policy seam; it authorizes no later stage.

## 2. Facts, inferences, and assumptions

### Verified repository facts

- ADR-0031 selects Telnyx as primary carrier and Twilio as failover behind
  `CarrierProvider`.
- ADR-0032 selects Vapi as the broader v0.3 voice-orchestration baseline behind
  `VoiceAgentProvider`.
- ADR-0045 permits a Telnyx-first bounded demo with Vapi optional.
- ADR-0047 implements a supervised, inbound-only Telnyx AI Assistant post-call
  evidence chain and explicitly excludes realtime audio control and Vapi.
- The repository now contains mock-safe carrier and voice-agent contracts,
  signed Telnyx ingest, canonical call persistence, and guarded HubSpot sync.
- This branch adds a pure virtual-extension contract, deterministic two-account
  mock directory, resolver, and mock-event mapper with no runtime consumer.
- No persistent registry, operator configuration, transfer execution, trusted
  presence source, or live Vapi adapter is shipped.

### Current provider facts

- Telnyx supports +1 toll-free voice numbers and can associate purchased local
  or toll-free numbers with a Voice API application.
- Vapi documents active-call transfers to PSTN numbers and SIP destinations.
- Vapi documents an `extension` value for a phone-number destination, dialed
  after the destination answers.
- Vapi documents runtime-selected transfer destinations through server-side
  business logic and live call control.
- A Vapi forwarded-call state proves transfer initiation, not downstream
  connection. Carrier or destination-leg evidence is required before
  ResponseOS records `call.transfer.connected`.

### Inferences

- ResponseOS can preserve extension meaning across provider changes by keeping
  extension lookup, policy evaluation, and route-decision evidence above the
  provider adapter boundary.
- Natural-language routing and DTMF can share one deterministic policy engine:
  the voice model extracts a candidate intent, but ResponseOS authorizes the
  destination.
- A toll-free main line can front the same routing model as a local DID; the
  number type does not need to change extension semantics.

### Unverified assumptions

- The AJ Digital Telnyx account is eligible to order a +1 toll-free number.
- A suitable toll-free or vanity number is available.
- Telnyx-to-Vapi SIP behavior, transfer reliability, latency, and downstream
  answer evidence satisfy the private-demo acceptance gates.
- A trusted calendar or presence source will exist for live availability.
- The first pilot needs more than a single human transfer and message fallback.

`1-800-AJ-DIGITAL` is a display concept, not an approved or canonical number.
North American toll-free numbers contain seven subscriber digits after the
toll-free prefix, while `AJ-DIGITAL` contains nine letters. No code or public
copy may encode that mnemonic until an actual E.164 number is acquired and any
over-dial behavior is tested from outside networks.

## 3. Problem

The current supervised demo can capture and prove a completed AI-assisted call,
but it does not provide an account-owned directory for callers who dial an
extension or ask for a person or department. Hard-coding destinations in Telnyx
or Vapi would make provider configuration the business-policy source of truth,
weaken auditability, and create migration churn when a carrier, voice runtime,
phone number, staff member, or fallback path changes.

Building a general PBX would create the opposite problem: ResponseOS would
duplicate commodity telecom, queue, presence, and media infrastructure before
the first live evidence chain proves that complexity is required.

## 4. Desired outcome

Define a provider-neutral routing capability where:

- an inbound DID maps to exactly one account through trusted server state;
- DTMF and spoken intent resolve to the same account-scoped virtual extension;
- routing policy selects only an authorized destination reference;
- provider adapters execute transfers without owning business semantics;
- every decision and transition is tenant-scoped, replay-safe, and auditable;
- attempted, initiated, connected, failed, and fallback states remain distinct;
- the application still boots and tests without provider credentials;
- the first implementation can remain mock-only and reversible.

## 5. Users and jobs

| User | Job |
|---|---|
| Caller | Reach the correct person, department, or fallback by speech or DTMF without understanding the underlying phone system. |
| Tenant operator | Change a route or business-hours fallback without rewriting an assistant prompt or carrier configuration. |
| AJ Digital operator | Inspect why a route was selected, whether a transfer really connected, and which fallback ran. |
| Voice agent | Request a route using normalized intent and receive one authorized destination or refusal. |
| CRM sync | Receive bounded commercial activity after canonical ResponseOS evidence exists; never decide the route. |

## 6. Architecture and ownership

```text
Telnyx DID / SIP
      |
      v
Active voice runtime
(Telnyx AI Assistant for the bounded demo;
 Vapi for the broader v0.3 path when separately authorized)
      |
      | route request: DTMF or normalized intent
      v
ResponseOS route-decision boundary
      |
      +--> account-owned extension registry
      +--> versioned routing policy
      +--> schedule/presence evidence when available
      |
      v
Authorized destination reference or safe fallback
      |
      v
Provider transfer execution -> PSTN / SIP / voice agent / message capture

Provider callbacks -> signed WebhookEvent -> canonical ledger/call evidence
                                         -> bounded asynchronous HubSpot sync
```

| Layer | Responsibility |
|---|---|
| Telnyx | DID, PSTN/SIP transport, carrier call legs, signed carrier evidence. |
| Vapi or active voice runtime | Conversation, keypad input, intent extraction, transfer execution, runtime call context. |
| ResponseOS | Account resolution, extension registry, policy evaluation, authorization, decision evidence, fallback selection. |
| HubSpot | Default external commercial CRM activity after canonical evidence exists. |
| ResponseOS event ledger | Internal system of record for routing, transfer, transcript, disposition, and sync evidence. |

ResponseOS does not own RTP media, SIP registration, carrier routing tables,
queues, or a generalized presence service.

## 7. Canonical routing hierarchy

### 7.1 Inbound number to account

The normalized inbound E.164 number maps to one account in trusted server-owned
configuration or persistence. Provider webhook payloads may identify the DID,
but callers and public clients never supply or override `accountId`.

### 7.2 Account to virtual extension

An extension is an account-scoped alias, not a globally unique phone address.
The same code may exist in different accounts. `0` is reserved for the
account's operator/fallback policy. Other reserved ranges are deferred until a
real tenant need justifies them.

### 7.3 Virtual extension to policy

Each enabled extension resolves to one active, versioned policy. A route
decision records the exact policy version used so later configuration changes
do not rewrite historical evidence.

### 7.4 Policy to destination

A policy returns an authorized destination reference, not an arbitrary number
provided by the caller or model. Candidate destination types are:

- `human_pstn`
- `sip`
- `voice_agent`
- `message_capture`

Queues, voicemail boxes, round-robin distribution, and multi-destination hunts
remain deferred.

## 8. Routing behavior

The deterministic precedence is:

1. Exact DTMF extension entered by the caller.
2. Explicit spoken person or department resolved to one extension alias.
3. Clarification when multiple aliases match.
4. Account default/receptionist route when no explicit target exists.
5. Operator or message-taking fallback when the route is unknown, unavailable,
   or fails.

The voice model may extract `{ requestedExtension, department, person, reason }`.
It must not return or invent the final telephone number, SIP URI, account, or
policy result.

Unknown-extension behavior for the first slice is one clarification attempt,
then message capture. Transfer loops and transfers back to the inbound DID must
be rejected.

## 9. Availability truth

ResponseOS must not state that a person is available without a trusted source.
The allowed availability states are:

| State | Evidence |
|---|---|
| `unknown` | No trusted schedule or presence evidence. |
| `scheduled` | Static business-hours or on-call configuration matched. This is not live presence. |
| `confirmed_available` | A separately authorized calendar/presence adapter returned current evidence. |
| `confirmed_unavailable` | A trusted adapter or explicit operator setting returned current evidence. |

Until a live source is approved, policy may say "within configured routing
hours" but not "Audio is available now."

## 10. Conceptual contracts

### Route request

| Field | Rule |
|---|---|
| `accountId` | Required; resolved server-side. |
| `callId` | Required canonical ResponseOS call identifier. |
| `providerCallId` | Optional provider correlation reference. |
| `requestedExtension` | Optional normalized string from DTMF or speech. |
| `intent` | Optional normalized department/person intent. |
| `occurredAt` | Required strict timestamp. |
| `source` | `dtmf`, `speech`, or `default`. |

### Route decision

| Field | Rule |
|---|---|
| `decisionId` | Stable idempotency and audit identifier. |
| `accountId` / `callId` | Must match the request scope. |
| `extensionRef` | Internal reference; nullable for unresolved routes. |
| `policyRef` / `policyVersion` | Exact policy evidence used for the decision. |
| `destinationRef` | Authorized internal reference; never caller-supplied. |
| `destinationType` | One of the allowed destination types. |
| `availabilityState` | Uses the evidence vocabulary in §9. |
| `outcome` | `resolved`, `clarify`, `fallback`, or `rejected`. |
| `reasonCode` | Stable, non-provider-specific reason. |

Provider payloads and raw destination values stop at their adapter boundaries.

## 11. Canonical event contract

| Event | Meaning and evidence threshold |
|---|---|
| `call.route.requested` | DTMF, speech, or default route entered the policy boundary. |
| `call.route.resolved` | One versioned policy returned an authorized destination reference. |
| `call.route.unresolved` | No extension or intent matched after the allowed clarification. |
| `call.transfer.requested` | ResponseOS authorized a transfer request. |
| `call.transfer.initiated` | The provider accepted or initiated transfer execution. |
| `call.transfer.connected` | The downstream call leg answered according to carrier/destination evidence. Never inferred from initiation alone. |
| `call.transfer.failed` | Provider evidence or a bounded timeout proves the transfer did not connect. |
| `call.fallback.selected` | Message capture or another approved fallback was selected. |
| `call.message.recorded` | The fallback message was durably captured. |
| `crm.sync.completed` | A bounded external CRM write completed after canonical evidence existed. |

Every event carries `accountId`, canonical `callId`, correlation/dedupe identity,
strict occurrence time, source, evidence reference, and policy version where
applicable. Revenue states are not implied by any routing or transfer event.

## 12. Persistence candidates

No schema change is authorized. If persistence is approved later, the smallest
candidate model set is:

| Candidate | Purpose |
|---|---|
| `InboundNumberRoute` | Trusted DID-to-account mapping and active provider reference. |
| `VirtualExtension` | Account-scoped code, aliases, label, enabled state, and active policy reference. |
| `RoutingPolicy` | Versioned rules, schedule reference, fallback, and lifecycle status. |
| `RouteDestination` | Account-scoped destination type and protected provider-specific reference. |
| `RouteDecision` | Immutable decision, evidence, policy version, and transfer correlation. |

Before any migration, the implementation brief must determine whether existing
`ProviderConnection`, `Call`, `WebhookEvent`, `WorkflowRun`, and audit models
can carry part of this contract without duplication. A persistent model choice
is a new architecture decision and requires an ADR update plus its own approved
schema PR.

## 13. Scope

### In scope for this planning artifact

- Provider-neutral ownership and boundary decisions.
- A minimal mock-only candidate slice.
- Canonical request, decision, event, evidence, tenant, and fallback rules.
- A staged implementation sequence and validation gates.
- Current Telnyx/Vapi capability references and account-eligibility caveat.

### Explicitly out of scope

- Modifying the merged ADR-0047 GTM demo closure.
- Live Telnyx, Vapi, Twilio, HubSpot, calendar, or presence changes.
- Toll-free search, reservation, purchase, porting, assignment, or public copy.
- Provider SDKs, env vars, secret access, SIP trunk configuration, or assistant
  tool configuration.
- Schema migration, API route, UI, prompt, transfer, or CRM implementation.
- General PBX features, queues, ring groups, voicemail administration,
  multi-destination hunting, extension provisioning, or live presence.
- Deployment, activation, outside-number testing, or prospect release.

## 14. Proposed delivery sequence

### Stage 0 — Planning

Completed by this PRD, roadmap cross-reference, and dashboard task.

### Stage 1 — Contracts and deterministic mocks

Authorized on 2026-08-20 and implemented in this change. Scope:

- provider-neutral route-request and route-decision types;
- deterministic account-scoped mock directory;
- `101`/sales synthetic human destination;
- `0` message-taking fallback;
- one clarification for unknown extensions;
- canonical mock events and unit tests;
- no schema, env, SDK, network, or live destination.

Stage 1 is locked as follows so a later approved implementation does not need
to infer product behavior:

| Decision | Stage 1 value |
|---|---|
| Tenant fixtures | Two synthetic account IDs supplied by the test/service boundary; neither the public demo nor internal-demo account is hard-coded. |
| Directory | Each account gets its own deterministic directory. Account A: `101`/`sales` and `0`/`operator`; Account B exists only to prove isolation. |
| Destination | `101` returns a synthetic `human_pstn` reference, never a real number. `0` returns `message_capture`. |
| DTMF vs speech | A valid explicit DTMF extension wins. A conflicting speech candidate is recorded through reason code `dtmf_precedence`. |
| Normalization | Trim extension input; lowercase and collapse whitespace for spoken aliases. Do not fuzzy-match names. |
| Unknown extension | `clarificationCount = 0` returns `clarify`; `clarificationCount >= 1` returns the `0` message fallback. |
| No requested target | Return the `0` message fallback; do not invent a destination. |
| Availability | Always `unknown`; Stage 1 has no schedule or presence source. |
| Idempotency | The caller supplies `routeRequestId`; the pure resolver returns a stable decision ID derived from account, call, and request identity. |
| Side effects | None. The resolver and event mapper are pure; no database, provider, clock, environment, or network access. |

Stage 1 implementation manifest:

| File | Responsibility |
|---|---|
| `lib/routing/virtualExtensions/types.ts` | Route request/decision types, destination and availability vocabularies, reason codes. |
| `lib/routing/virtualExtensions/mockDirectory.ts` | Two-account deterministic fixture and account-scoped lookup. |
| `lib/routing/virtualExtensions/resolveRoute.ts` | Pure normalization, precedence, resolution, clarification, fallback, and stable decision identity. |
| `lib/routing/virtualExtensions/events.ts` | Pure mapper from request/decision to canonical mock event envelopes. |
| `lib/routing/virtualExtensions/index.ts` | Narrow public exports only. |
| `tests/unit/virtual-extension-routing.test.ts` | Resolution, DTMF precedence, alias normalization, isolation, fallback, idempotency, event-state, and no-live-destination tests. |
| `dashboard/dashboard-data.json` | Mark the separately approved implementation task in progress/review as work changes. |
| `docs/CHANGELOG.md` | Add a newest-first entry only in the implementation PR that is intended to merge. |

Stage 1 must not modify `CarrierProvider`, `VoiceAgentProvider`, Telnyx ingest,
HubSpot sync, Prisma, an API route, an assistant prompt, or any environment
contract. It creates a policy seam only; integration is a later stage.

### Stage 2 — Persistence and operator configuration

Requires accepted model/ADR decisions and a separate schema/UI authorization.
Add only the minimum persistent directory and immutable route evidence proven
necessary by Stage 1.

### Stage 3 — Private live transfer proof

Requires Gate Set B authorization and the ADR-0047 evidence chain to remain
green. Validate one inbound number, one human destination, one fallback, one
failure drill, provider correlation, and downstream connection evidence with
visibility disabled.

### Stage 4 — Toll-free and multi-route expansion

Requires verified account eligibility, acquired number, cost controls, private
outside-network testing, and evidence that more extensions improve the pilot.
Only then consider a larger department directory or live presence.

## 15. Success criteria

### Planning acceptance

- The feature is explicitly separate from ADR-0047 closure scope.
- Extension meaning remains ResponseOS-owned and provider-neutral.
- Tenant, evidence, availability, claims, and approval boundaries are explicit.
- The first candidate slice is mock-only, bounded, and reversible.
- ROADMAP and dashboard status match this document.

### Stage 1 acceptance

- Speech "sales" and DTMF `101` produce the same deterministic route decision.
- `0`, an unknown extension after one clarification, and an empty target choose
  the approved message fallback without a live call.
- An unconfigured account is rejected without a destination.
- Cross-account extension lookup is rejected.
- Callers and model output cannot select `accountId` or a raw destination.
- Duplicate route requests do not produce duplicate decisions/events.
- Transfer initiation is not represented as connection.
- The application boots and tests with no provider credentials.

### Future live-proof acceptance

- One private outside-number call reaches the correct destination.
- Carrier evidence proves the downstream leg connected.
- No-answer and provider-failure drills create the correct failure and fallback
  events without duplicate effects.
- Kill switch, spend cap, signature rejection, tenant isolation, and rollback
  are observed, not inferred.
- The actual number and disclosures are operator-approved before exposure.

## 16. Risks and mitigations

| Risk | Consequence | Mitigation |
|---|---|---|
| PBX scope creep | ResponseOS duplicates telecom infrastructure before product proof. | Limit the first slice to one route and fallback; buy transport/transfer capabilities. |
| False connection evidence | Operators believe a human answered when only transfer initiation occurred. | Require downstream carrier/destination evidence for `connected`. |
| False availability | The agent claims a person is available without current evidence. | Use the §9 vocabulary and default to `unknown`. |
| Provider lock-in | Vapi or Telnyx configuration becomes the canonical directory. | Keep policy and evidence provider-neutral; provider payloads stop at adapters. |
| Tenant crossover | One account routes to another account's destination. | Resolve account server-side and scope every lookup/reference by `accountId`. |
| Transfer loop or hairpin | Calls recurse, fail, or create uncontrolled cost. | Reject inbound-DID destinations and bound attempts/fallbacks. |
| Toll-free eligibility or availability | Planned public identity cannot be acquired. | Verify the Telnyx account and search/reserve before copy or configuration. |
| Privacy exposure | Destination numbers, transcripts, or caller data leak. | Use internal destination references, authenticated surfaces, retention controls, and bounded CRM exports. |
| Latency | Runtime policy lookup harms call experience. | Keep the first policy deterministic and measure end-to-end latency before expansion. |
| Premature multi-route build | Time is diverted from the first supervised live proof. | Stage behind ADR-0047 rehearsal and measured pilot need. |

## 17. Architecture review checklist

1. **Layer:** Communications Capture (Layer 1) plus operational evidence in
   Business Memory capture (Layer 2).
2. **Build/integrate/defer:** Integrate telephony and voice execution; build
   canonical policy/evidence; defer PBX, queues, and generalized presence.
3. **Live pilot:** One human transfer and fallback can improve the pilot after
   the post-call evidence chain is proven.
4. **Evidence:** Versioned decisions and provider correlation preserve why and
   how a route occurred.
5. **Verified outcomes:** Routing proves no booked, completed, collected, or
   recovered revenue by itself.
6. **Proprietary learning:** Later route outcomes may improve tenant policy;
   the initial directory creates no moat alone.
7. **Commodity capability:** DID, SIP, PSTN, DTMF, media, and transfer execution
   are bought.
8. **Duplication:** The design rejects CRM, FSM, carrier, PBX, and workflow-engine
   duplication.
9. **Lock-in:** Canonical extension, policy, and event semantics survive a
   Telnyx/Vapi replacement.
10. **Tenant isolation:** DID resolution and every route lookup are
    server-owned and account-scoped.
11. **Attribution:** No revenue attribution is introduced; transfer states are
    evidence-specific.
12. **Claims:** The pure Stage 1 policy seam is `EXPERIMENTAL`; persistent or
    live routing stays `DOCUMENTED_ONLY` until the relevant stage produces
    evidence.
13. **Human approval:** Number procurement, destination configuration, policy
    activation, live providers, and public access require explicit approval.
14. **Compliance:** Calls, caller identity, transcripts, recordings, and
    destination data add consent, retention, and PII exposure.
15. **Required now:** The bounded Stage 1 mock route is implemented. A full
    directory is strategically interesting, not currently required.

## 18. Open decisions after Stage 1

1. Is the first proof for the ResponseOS demo account only, or for the AJ Digital
   internal tenant?
2. After ADR-0047 rehearsal, should Telnyx AI Assistant or Vapi own the first
   transfer execution?
3. Which actual E.164 toll-free or local number is eligible and available?
4. What protected real destination would a later private proof use?
5. What are the exact business-hours timezone and fallback rules?
6. Should Stage 1's DTMF precedence remain authoritative in a live runtime?
7. Which trusted adapter, if any, will supply live availability?
8. What timeout and evidence source define `call.transfer.failed`?
9. What retention and redaction rules apply to route-decision evidence?
10. Which operator owns the kill switch, spend cap, rollback, and outside-number
    rehearsal evidence?

## 19. Explicit approval boundary

The current authorization ends at **Stage 1 — Contracts and deterministic
mocks only**.

Any Stage 2 persistence or operator-configuration work requires accepted
model/ADR decisions and a separate `proceed` statement. It must not silently
include a live destination, provider SDK, env var, secret, external account
mutation, deployment, or public exposure. Stages 3–4 remain independently gated.

## 20. Current primary sources

- [Telnyx Voice API fundamentals](https://developers.telnyx.com/docs/voice/programmable-voice/voice-api-fundamentals)
- [Telnyx number search and vanity-number workflow](https://support.telnyx.com/en/articles/4380325-search-and-buy-numbers)
- [Telnyx +1 toll-free ordering restrictions](https://support.telnyx.com/en/articles/10715715-phone-number-ordering-restrictions)
- [Vapi transfer call tool](https://docs.vapi.ai/tools/transfer-call)
- [Vapi dynamic call transfers](https://docs.vapi.ai/calls/call-dynamic-transfers)
- [Vapi Telnyx SIP integration](https://docs.vapi.ai/advanced/sip/telnyx)
