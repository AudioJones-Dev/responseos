# Internal demo account + professional receptionist

**Status:** Shipped substrate, mock-first. See [ADR-0046](../DECISIONS.md#adr-0046--the-internal-demo-tenant-is-a-first-class-account-not-a-second-application-career-truth-stays-outside-responseos).
**Applies to:** the `tyrone-nelms` reference tenant (`account_type = internal_demo`).

> **Status vocabulary** (doctrine §2.1) for what this document describes:
> `SHIPPED` — account classification, agent profiles, professional
> opportunities, claim-authority policy, verified-only answering,
> mock scheduling → appointment → opportunity link, audit trail,
> reporting exclusion, operator console surface.
> `DOCUMENTED_ONLY` — Career OS as a live knowledge source, live
> telephony for this tenant, any public "talk to my AI assistant"
> surface.
> `PROHIBITED_CLAIM` — that this tenant proves provider portability
> (ADR-0043), that the receptionist answers verified career questions
> today (it does not; see §4), or that any live provider is wired.

## 1. What this is

A ResponseOS tenant that ResponseOS uses on itself. It exists to be
dogfooded, demonstrated, and regression-tested, and it runs on the same
runtime as a paying customer: same schema, same tenant-scoped
accessors, same audit trail, same provider abstractions, same mock-first
guarantee. There is no second application and no demo-only data path.

## 2. What was added

| Layer | Addition |
|---|---|
| Schema | `Account.account_type` (`AccountType`), `AgentProfile`, `ProfessionalOpportunity` — migration `0009` |
| Types | `types/agentProfile.ts`, `types/professionalOpportunity.ts`, `AccountType` on `types/account.ts` |
| Data layer | `lib/data/agentProfiles.ts`, `lib/data/professionalOpportunities.ts`, `createAppointment` |
| Providers | `lib/providers/professionalKnowledge/*` (fixture-backed), `lib/providers/professionalHandoff/*` (no-op) |
| Domain | `lib/professional/*` — intent, claim authority, profile policy, receptionist answering, intake/scheduling write path |
| Reporting | `lib/revenue/customerRevenueScope.ts`, applied to cross-tenant revenue reads |
| Console | `Type` column on `/admin/clients`, `/admin/receptionist` |
| Seed | The tenant, its owner, four agent profiles, a recruiter contact, an answered call with segments + transcript + QA log, an SMS thread, a booked recruiter screen, one professional opportunity, a workflow run, an audit row |

Reused unchanged: `Appointment`, `Call`, `CallSegment`, `CallTranscript`,
`Conversation`, `SmsMessage`, `QaLog`, `WorkflowRun`, `AuditLog`.

## 3. The boundary

```
Recruiter / prospect
        │
        ▼
   ResponseOS  ──  tenant · conversation · qualification · scheduling
   (this repo)     memory · workflow · QA · audit · reporting
        │
        ├── ProfessionalKnowledgeProvider ──▶ Career OS (not wired)
        │      profile · experience · projects · skills · assets
        │
        └── ProfessionalHandoffProvider  ──▶ Career OS (not wired)
               professional.opportunity.created
               professional.escalation.requested
```

Career truth never enters this schema. Career workflows never read this
schema. The two interfaces above are the entire contract.

## 4. Why the receptionist declines most career questions today

Every knowledge record carries a `verified` flag, and an answer requires
a record that is **both verified and in the category asked about**.
The shipped fixture marks work history, projects, skills, education, and
certifications as **unverified placeholders**, because fabricating an
employer, a date, a degree, or a certification is prohibited
(`AGENTS.md`; doctrine §2.2, §20).

So the receptionist today:

- **answers** who it represents, engagement availability, and which
  public assets can be shared;
- **falls back** — "I don't have verified information available for
  that…" — on every unsourced career claim;
- **escalates** compensation, consulting rates, and references;
- **refuses** private questions;
- **looks up** interview availability against the calendar rather than
  quoting a time from memory.

Turning career answers on is a **data change, not a code change**: supply
canonical records (or wire the Career OS adapter) and flip `verified`.

## 5. Agent profiles

Four profiles, all scoped to the tenant, one marked default:

| Profile | Books | May share |
|---|---|---|
| Recruiter Receptionist *(default)* | `recruiter_screen`, `hiring_manager_interview` | resume, portfolio, LinkedIn, GitHub |
| Consulting Receptionist | `consulting_discovery` | portfolio, case study |
| Professional Assistant | `professional_intro` | portfolio, LinkedIn |
| Demo Mode | `demo` | — |

Policy lives in `AgentProfile.system_policy_json`
(`AgentProfilePolicy`). It can only narrow the claim-authority matrix —
an `escalate` category can be made `refuse`, never `answer` — and a
malformed policy resolves to the strict default. Only public assets of
an allowed type are ever shareable, so private repositories and
unpublished case studies cannot leak through a policy edit.

## 6. Reporting

| Metric family | Internal demo tenant |
|---|---|
| Operational usage, provider cost, QA, reliability | **included** |
| Cross-tenant revenue rollup, paid customer count, recovered customer revenue | **excluded** |

Scoped per-tenant reads are untouched — the tenant sees its own numbers.
Only the unscoped operator rollup drops non-`customer` accounts.

## 7. Mock-first

Neither new adapter passes `createLive`, so both resolve to
fixture/no-op even when `CAREER_OS_API_KEY` or `CAREER_OS_WEBHOOK_URL`
is set. Scheduling runs through the existing mock `SchedulingProvider`.
The full flow — question → grounded answer or fallback → opportunity
capture → audit row → handoff event → booked appointment linked back to
the opportunity — runs with zero credentials and makes no network call.

Live telephony for this tenant remains gated behind v0.3 authorization
(ADR-0019, ADR-0045). Nothing here authorizes a live provider.

## 8. Verification

`npm run lint` · `npm run typecheck` · `npm test` · `npm run build`, plus
`npm run test:integration` against Postgres 16 — including seed
determinism, mock-fixture parity for both new tables, the tenant-scope
matrix, the audited write path, policy-denied booking, and the reporting
exclusion.
