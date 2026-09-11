# ResponseOS Client Operating-Configuration Standard

**Status:** Canonical contract. States below describe the repository once the change introducing this document merges.
**Owner:** AJ Digital LLC / Audio Jones
**Governing decisions:** ADR-0051 decision 3 and its 2026-09-10 amendment; ADR-0046 §9; ADR-0048.

This standard defines where a tenant's operating configuration lives, how an operator-entered fact is
evidenced, which fact wins when two disagree, and what each supervision mode requires before it may be
activated. It does not create configuration for any client, authorise a live provider, or activate a mode.

Status tokens are the doctrine §2.1 vocabulary.

---

## 1. Where client configuration lives

There is no `ClientConfig`, `TenantSettings`, or `lib/client-config/`. Each part of a client's
configuration already has a home.

| Part | Home | State |
|---|---|---|
| Identity — name, slug, industry, website, timezone | `Account` | `SHIPPED` |
| Supervision tier | `ExecutionMode` in `lib/agentExecution/policy.ts` | `SHIPPED` as policy; every tier above the demo lane is gated |
| Commercial lifecycle | `AccountStatus` — `lead`, `active`, `paused`, `cancelled` | `SHIPPED` |
| Users and roles | `UserRole` — `aj_admin`, `operator`, `client_admin`, `client_viewer` | `SHIPPED` |
| Operating configuration — hours, holidays, service area, escalation contacts, consent posture | Approved facts on `BusinessMemorySnapshotSchema` | `PARTIALLY_SHIPPED` — contract only; see §7 |
| Phone number | `TelephonyNumber` + `TelephonyNumberAssignment` | `PARTIALLY_SHIPPED` |
| Provider connections | `ProviderConnection` | `PARTIALLY_SHIPPED` — live providers are v0.3-gated |
| Agent behaviour | `AgentProfile.system_policy_json` + the execution policy for the tenant's mode | `SHIPPED` |

`account_type` is administrative only and must not gate any of the above (ADR-0046 §2).

---

## 2. Fact keys

Operating configuration is stored as approved facts. A fact's key prefix decides its snapshot section.

| Key prefix | Snapshot section |
|---|---|
| `operating_hours.` | `operatingHours` |
| `service_area.` | `serviceAreas` |
| `contact.` | `contactPaths` |
| `policy.` | `policies` |
| `service.` | `services` |
| `location.` | `locations` |
| `faq.` | `faqs` |
| `brand_voice.` | `brandVoice` |
| anything else | `businessProfile` |

---

## 3. Statuses and the evidence each must cite

| Status | Meaning | Required evidence |
|---|---|---|
| `operator_approved_for_demo` | An operator approved a publicly sourced fact for the prospect demo (ADR-0048) | Web source — `https` URL, content hash, excerpt hash, fetch time |
| `owner_confirmed` | The business owner confirmed the fact | Web source |
| `operator_configured` | An operator entered the fact as structured configuration | Operator assertion — approval-record reference, content hash, who asserted it, when |

The schema enforces the pairing in both directions: operator-assertion evidence is rejected on any status
other than `operator_configured`, and an `operator_configured` fact that cites a web source is rejected.

The pairing is checked fact by fact. It does not keep `operator_configured` facts out of any particular
snapshot, because the prospect demo and tenant operating configuration share `BusinessMemorySnapshotSchema`
(ADR-0051 decision 3). The prospect demo is kept to publicly sourced facts (ADR-0048) in two places:
`compileBusinessMemorySnapshot()` compiles only `operator_approved_for_demo` and `owner_confirmed` facts, and
`compileProspectAgentContext()` leaves every `operator_configured` fact out of the demo agent's context.

Web evidence carries no `kind` field. Adding one would change the content hash of every snapshot already
stored, and promotion re-verifies that hash.

`operator_configured` exists on the snapshot contract only. The database `KnowledgeFactStatus` enum does not
contain it.

---

## 4. Authority when facts disagree

| Rank | Status |
|---|---|
| 2 | `owner_confirmed` |
| 1 | `operator_approved_for_demo`, `operator_configured` |

Equal ranks resolve to the most recent `reviewedAt`, then `validAsOf`, then `id`.

- **Single-value keys** keep only the winning fact.
- **Multi-value keys** — `contact.phone`, `contact.email`, and the `*.statement` keys — keep every distinct
  value once, taking the highest-authority copy of each.
- Only facts whose source was acquired are ranked, so an unsourced higher-authority fact cannot displace a
  sourced one.
- Facts marked `conflicted` are never resolved by rank. Their conflict groups are listed in the snapshot's
  `conflicts` and must be settled by human review.

**State.** Ranking of web-sourced facts is `SHIPPED` in `compileBusinessMemorySnapshot()`. The placement of
`operator_configured` is an operator decision recorded in the ADR-0051 amendment; it is `ROADMAP` until the
compiler accepts operator-entered facts.

---

## 5. What each mode requires

| Mode | Required operating configuration |
|---|---|
| `PROSPECT_DEMO` | none beyond the shipped demo lane |
| `SUPERVISED_PILOT` | `operating_hours.weekly`, `operating_hours.holidays`, `service_area.coverage`, `contact.escalation`, `policy.consent` |
| `PRODUCTION_SUPERVISED` | same as `SUPERVISED_PILOT` |
| `MANAGED_AUTONOMY` | same as `SUPERVISED_PILOT` |

A requirement is met by a fact whose key equals it or begins with it followed by `.` — so
`contact.escalation.primary` satisfies `contact.escalation`, and `contact.escalation_backup` does not — and
whose value is not empty. `null`, a blank string, and `{}` count as missing. An empty list is a value:
`operating_hours.holidays: []` records that no holiday closures apply. The shape of a value is not checked, so
the evaluator cannot tell a usable schedule or contact from a malformed one (§7).

`evaluateOperatingConfiguration()` in `lib/agentExecution/operatingConfiguration.ts` returns `ready`,
`missing`, and `conflicts`. A snapshot is ready only when nothing is missing **and** no conflict is recorded.
An unrecognised mode is evaluated against the supervised requirements, never the demo lane's empty list.

**Readiness is not activation.** A ready snapshot opens no gate. Activation stays governed by
`EXECUTION_MODE_ACTIVATION_GATES`, the environment flags, and the roadmap.

---

## 6. Unresolved values

A value without approved evidence is never written as a fact, not even as a placeholder. It is recorded as
a plain statement in the snapshot's `unknowns`. This is the same rule the client-delivery templates apply:
unsupported values start as `unknown`.

---

## 7. Not yet built

| Gap | State |
|---|---|
| A write path that creates `operator_configured` facts — service function, route, or operator UI | `ROADMAP` |
| `evaluateOperatingConfiguration()` called by any activation path | `ROADMAP` |
| Value shapes for the five required keys, and a write-path check that keeps placeholder values out (§6). Still open: what shape weekly-hours, holiday, coverage, escalation, and consent values take | `ROADMAP` — decided with the write path or the first activation caller, whichever lands first |
| Operating configuration for any real tenant | Not started. The first — Florida Ramp & Lift — follows as a separate change once the operator approves its location and data-handling boundary ([`README.md`](./README.md)) |
| Promotion that preserves tenant identity (ADR-0051 decision 2) | `ROADMAP` — `BootstrapPromotion` still creates a new `Account` |

---

## Change log

| Date | Change | Author |
|---|---|---|
| 2026-09-10 | Initial standard | Claude Opus 5, for Audio |
