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
> (ADR-0043), that the receptionist can speak to categories with no
> canonical source (case studies; see §4), that the two internal
> projects it can describe are shipped or deployed products, or that any
> live provider is wired.

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

## 4. What the receptionist can and cannot say

Every knowledge record carries a `verified` flag, and an answer requires
a record that is **both verified and in the category asked about**.
Fabricating an employer, a date, a degree, or a certification is
prohibited (`AGENTS.md`; doctrine §2.2, §20), so a category with no
canonical source produces the fallback line rather than a guess.

The fixture now carries two canonical imports: the account owner's
resume, imported on the date in `RESUME_IMPORTED_AT`, and the public
portfolio at `tyronenelms.com` — its project pages and its résumé page
— read on the date in `PORTFOLIO_IMPORTED_AT`. Nothing in either is
inferred: skills arrive as the flat list the resume supplies, and no
achievement or metric is written that neither source states.

**Dates are stored at source precision.** Every role now carries a
range, but only to the precision its source gives: year-only where the
portfolio states a year, month where it states a month. Widening `2015`
into a guessed month would be inventing a date, so a test pins the
format to `YYYY` or `YYYY-MM` and asserts the year-only entries stay
year-only. The two current roles carry no end date; every past role
does.

**Project status is part of the claim.** Two of the three projects are
internal systems with no external customers and no production
deployment. A recruiter hearing a project named assumes a shipped
product unless told otherwise, so each record's summary carries the
status its own source page states — "active engagement", "internal
system" — and the receptionist speaks that status with the project
(doctrine §20).

So the receptionist today:

- **answers** who it represents, work history, skills, projects,
  education, certifications (with their Coursera verification links),
  the roles being targeted, engagement availability, and which public
  assets can be shared;
- **falls back** — "I don't have verified information available for
  that…" — on **case studies**, the one category with no canonical
  source yet;
- **escalates** compensation, consulting rates, and references;
- **refuses** private questions;
- **looks up** interview availability against the calendar rather than
  quoting a time from memory.

**Links travel one route only.** No answer body carries a URL. A link
reaches a caller only through `listShareableAssets`, which filters the
approved-asset list by the answering profile's `allowedAssetTypes` — so
an asset that is not registered cannot be offered however the profile is
configured, and a profile that allows no types shares nothing even when
the question is answered in full. The registered assets are the personal
site, the résumé page, LinkedIn, GitHub, and the owner's email address.

Registration is not disclosure. The email is registered for every
profile but handed out only where `allowedAssetTypes` names `email` —
today the recruiter profile alone, which is also the account default.
Widening that to the consulting or general-assistant profile is a
per-profile line, not a code change.

Adding or retiring an answerable category stays a **data change, not a
code change**: supply canonical records (or wire the Career OS adapter)
and set `verified`. Re-import bumps `RESUME_IMPORTED_AT` or
`PORTFOLIO_IMPORTED_AT`, which is how staleness stays visible.

**Not stored on purpose.** The owner's salary floor is a compensation
claim, and compensation escalates to a human by policy — holding the
number in a recruiter-facing knowledge store would add exposure without
ever being spoken.

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
