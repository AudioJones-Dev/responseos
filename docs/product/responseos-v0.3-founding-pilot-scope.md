# v0.3 Founding-Pilot Scope & Acceptance Gates

**Status:** Written scope freeze for GitHub [#27](https://github.com/AudioJones-Dev/responseos/issues/27) / dashboard **V-02** / **V-03**. **This document does not authorize live providers, secrets, or production deploys.** Staged written authorizations (below) remain a human gate.
**Added:** 2026-08-06
**Owner (sign-off):** Audio (AJ Digital LLC)
**Governing canon:** ADR-0001 (mock-first), ADR-0019 (v0.3 gate), ADR-0031/0032/0033/0036/0037 (provider baseline), [`responseos-v0.3-authorization-brief.md`](./responseos-v0.3-authorization-brief.md), [`responseos-v0.3-provider-readiness.md`](./responseos-v0.3-provider-readiness.md), [`../ROADMAP.md`](../ROADMAP.md).

---

## 1. Verdict (frozen)

| Decision | Freeze |
|---|---|
| **Ship bar** | **Path B** — live Revenue Recovery for one founding pilot |
| **Intermediate** | **Path A** — hosted Clerk + Neon + Vercel client access (staging first) while telephony is wired |
| **Vertical** | Home services only |
| **Lane** | **Standard** only |
| **Commercial frame** | Sell **Revenue Recovery** / Founding Pilot package ([`../client-facing-offer.md`](../client-facing-offer.md), [`../pricing-and-onboarding.md`](../pricing-and-onboarding.md)) |
| **Stack** | Telnyx (primary) / Twilio (failover) · Vapi (primary; OpenAI preferred in-Vapi brain) / Retell (secondary) · HubSpot · Calendly · Neon · Clerk · Vercel |
| **Deferred infra** | Node voice gateway + Redis (ADR-0036) for the first founding-pilot slice |

Brand / public landing voice (Revenue Recovery vs Business Memory) remains **operator-owned**; agents draft only.

### 1.1 Demo-MVP dependency narrowing (amended 2026-08-08)

The **Stack** row above records the *target* provider set and is unchanged. It is **not** the
acceptance-dependency set for the first vertical slice ("One Call, End to End"). Freezing five live
provider integrations as acceptance criteria would make the demo depend on systems that contribute
nothing to the claim it must prove.

| Tier | Systems | Meaning |
|---|---|---|
| **Demo-MVP REQUIRED** | Telnyx → Vapi → ResponseOS · Neon · Clerk · Vercel | Live and working, or the slice does not exist |
| **SANDBOXED for Demo MVP** | CRM · scheduling · SMS actions | Executed through sandbox adapters against controlled demo resources. No external side effects. |
| **DEFERRED LIVE** | HubSpot · Calendly · Twilio/failover · Stripe · Redis · Node voice gateway | Remain in the target stack and in the staged ladder (§5). **Not** acceptance criteria for the demo. |

**Rationale.** The demonstrable claim is *call → canonical intelligence → durable memory →
explainable decision → sandbox action → provenance*. A real HubSpot write or a real Calendly booking
adds no evidence for that claim, while adding live-integration risk and external side effects to a
prospect-facing demo. Sandbox adapters are strictly *better* demo behaviour, not a compromise: they
make the controlled-environment requirement provable rather than incidental.

**Twilio failover is deliberately deferred** — failover from a carrier that is not yet live is
premature, and adding it to demo acceptance doubles the telephony surface before the primary path
has been proven once.

This narrowing changes **acceptance scope only**. It removes nothing from the architecture, and every
deferred system keeps its stage in §5 under the same authorization requirements.

---

## 2. In scope (founding pilot)

1. **Mock-first CAL** — `CarrierProvider` / `VoiceAgentProvider` / `SmsProvider` / `CrmProvider` / `SchedulingProvider` + deterministic mocks (authorization brief §1).
2. **Hosted Path A (staging)** — Neon staging, Clerk orgs → `Account`, Vercel staging URL, client portal login smoke; providers may still be mock.
3. **Live Path B (staging → prod, separately authorized)** — Telnyx voice + A2P SMS, Vapi orchestration, Twilio failover drill, HubSpot event sync, Calendly booking → `Appointment`, webhook signature validation before mutation (ADR-0009).
4. **Phase-1 Business Memory capture only** — transcript / summary / intent / qualification / appointment / follow-up / CRM-sync status into the **event ledger** (operational capture; not RAG).
5. **Seven RECOVER playbooks** against live staging numbers before prod.
6. **One Standard-lane home-services founding tenant** provisioned with no code change; human backup / on-call named.
7. **Defensible monthly ROI report** with evidence links (outcome-fee **preview / manual** — not in-app Stripe).

### Pilot success criteria

- ≥1 pilot live on Standard lane.
- Zero cross-tenant data-exposure incidents.
- Missed-call text-back SLO path exercised (`<60s` target).
- Defensible monthly recovered-revenue report delivered.
- Renew / convert intent recorded by operator.

---

## 3. Explicitly out of scope

| Item | When |
|---|---|
| HIPAA / regulated verticals / medical / legal pilots | After independent compliance review |
| Stripe billing + outcome-fee ledger automation | **v0.5** |
| Per-tenant RAG / Obsidian / GTM “Business Memory vault” product | **v0.4** (offer language + Phase-1 ledger capture only at go-live) |
| Full white-label / multi-domain polish | **v1.0** |
| Node voice gateway + Redis as first-slice hard dependency | Deferred (ADR-0036) |
| Selling GTM vault capacity tiers as shipped product | Not at founding-pilot go-live |
| Production deploys without provider-readiness + human prod approval | Forbidden |

**GTM note.** “Business Memory System” / vault language may appear in marketing drafts; **do not promise** Obsidian/RAG vault capacity at founding-pilot go-live. Vault ingestion and grounding stay **v0.4-gated** ([`../ROADMAP.md`](../ROADMAP.md) · Future Knowledge Layer).

---

## 4. Acceptance gates (V-03)

All gates below must pass before the founding pilot is considered shippable. Live cutover still requires the matching staged authorization in §5.

### 4.1 Engineering / CI

- [ ] `npm run lint && npm run typecheck && npm test && npm run build && npm run test:integration` green locally and in CI (`validate` + `integration`).
- [ ] App boots and runs with **zero** provider secrets (mock fallback).
- [ ] Tenant-isolation tests green on every new write path.
- [ ] Webhook signature validation mandatory before business mutation (ADR-0009); bad signatures → 401 / no-op.

### 4.2 Provider readiness (per provider)

Checklist from [`responseos-v0.3-provider-readiness.md`](./responseos-v0.3-provider-readiness.md) §7, including: account ownership, encrypted `ProviderConnection` credentials, env placeholders only in repo, signature secrets at deploy, schema enum coverage, CAL mock before live, A2P/number registration, failover + kill-switch, observability, non-prod validation.

### 4.3 Staging E2E (Path B)

- [ ] Missed call → SMS text-back (`<60s` SLO path) → AI answer or follow-up → book/quote → HubSpot update → events in ledger.
- [ ] Golden-call regression green on staging.
- [ ] Twilio failover + documented kill-switch verified.
- [ ] Disclosure / consent / recording policy for the pilot state documented.
- [ ] Rollback verified (mock fallback + deploy revert).

### 4.4 Production / pilot ops

- [ ] Written “provider-readiness passed” + **human prod approval**.
- [ ] Prod deploy (app only first; gateway/Redis still deferred).
- [ ] Founding tenant provisioned; baseline missed-call KPIs captured.
- [ ] First monthly ROI report with evidence links.
- [ ] Runbook owners named in [`../ops/RESPONSEOS_RUNBOOK.md`](../ops/RESPONSEOS_RUNBOOK.md).

### 4.5 Relation to deploy PR / #14

Deploy work (historical draft #14 or a replacement) stays **draft / blocked** until §4.1–§4.3 clear and the matching §5 authorizations exist. This scope doc closes the **#27 intent** (written scope + gates); it does **not** itself green-light a deploy PR.

---

## 5. Staged authorization checklist

**Human written authorization is still required.** Do **not** collapse these into one mega-greenlight. Each stage references [`responseos-v0.3-authorization-brief.md`](./responseos-v0.3-authorization-brief.md) for the mock-first pattern and stop conditions; later stages inherit the same mock-fallback / no-secrets-in-repo / tenant-isolation hard rules.

| Stage | Authorizes | Does **not** authorize | Prerequisite |
|---|---|---|---|
| **A — Mock CAL** | CAL interfaces + mock adapters + unit tests only ([authorization brief](./responseos-v0.3-authorization-brief.md) §1–§2) | Schema, webhooks, live SDKs, secrets, deploy | This scope freeze |
| **B — Schema / env placeholders** | Enum/env placeholder alignment (e.g. `telnyx`, Calendly); migrations with no live traffic | Live adapters, real secrets, deploy | Stage A merged + CI green |
| **C — Staging host (Path A)** | Neon staging + Clerk + Vercel **staging** deploy job; portal smoke; providers still mock | Live providers, prod deploy | Stage B (or explicit Path-A-only auth if schema not yet needed) |
| **D — Live Telnyx (staging)** | Telnyx voice + SMS + signatures → ledger | Other live providers, prod | Stages A–C; readiness §7 for Telnyx |
| **E — Live Vapi (staging)** | Vapi orchestration + tools/escalation | Prod | Stage D green |
| **F — Live Twilio failover (staging)** | Failover drill + kill-switch | Prod | Stage E green |
| **G — Live HubSpot (staging)** | CRM event sync (ledger remains internal SoR), implemented per the [`Telnyx-to-HubSpot ingestion brief`](./responseos-v0.3-telnyx-hubspot-ingestion-implementation-brief.md) | Prod | Stage F green (or parallel only if isolation tests cover both) |
| **H — Live Calendly (staging)** | Booking webhooks → Appointment | Prod | Stage G green |
| **I — Production founding pilot** | Prod app deploy + one Standard home-services tenant go-live | HIPAA, vault/RAG, Stripe outcome engine | §4 gates + Stages A–H |

Copy the matching template in §6 for each stage. Store signed statements outside the repo (operator vault / email); optionally link the issue comment on #27.

---

## 6. Authorization statement templates (for Audio to sign)

Fill one statement **per stage**. Unsigned = not authorized.

### 6.1 Stage A — Mock CAL only (first signature needed)

```
AUTHORIZATION — ResponseOS v0.3 Stage A (Mock CAL only)
Date: ____________
Signer: Audio / AJ Digital LLC

I authorize ONLY the mock-first Communications Abstraction Layer slice described in
docs/product/responseos-v0.3-authorization-brief.md §1–§2 and
docs/product/responseos-v0.3-founding-pilot-scope.md §5 Stage A:
  - CAL TypeScript interfaces + deterministic mock adapters + unit tests
  - Provider resolver falls back to mock when env vars are absent
  - Validation: lint, typecheck, unit, build, integration — all green; app boots with zero secrets

I do NOT authorize: schema migrations, webhook business mutations, live provider SDKs,
real secrets/accounts, staging/production deploys, v0.4 knowledge/RAG, or v0.5 billing.

Signature / acknowledgment: ______________________________
```

### 6.2 Stages B–I — copy/adapt

```
AUTHORIZATION — ResponseOS v0.3 Stage __ (____________)
Date: ____________
Signer: Audio / AJ Digital LLC

I authorize ONLY Stage __ as defined in
docs/product/responseos-v0.3-founding-pilot-scope.md §5, under the acceptance gates in §4
and the hard rules in AGENTS.md (no secrets in repo; tenant isolation; webhook signatures
before mutation; mock fallback when env absent).

Explicitly in scope for this stage:
  - ____________________________________________________________

Explicitly out of scope (still forbidden):
  - ____________________________________________________________

Prerequisites met: [ ] prior stage(s) signed  [ ] CI green  [ ] readiness checklist §7 (if live)

Signature / acknowledgment: ______________________________
```

---

## 7. Open items still owned by the operator (not closed by this doc)

1. **Sign** Stage A (then later stages) using §6 templates.
2. **First pilot client identity** (home services, Standard lane).
3. **Brand/copy finalization** for public landing (hold agent drafts).
4. **Production secret store** confirmation (Vercel env vs Doppler for prod) — ADR-0038 is opt-in tooling only.
5. **Production credential key posture** ADR superseding ADR-0020 before live tenant traffic (called out in the Live Pilot Ship plan; separate ADR PR).
6. **Staging number strategy** (platform-owned A2P per ADR-0036).

---

## 8. Dashboard / tracking mapping

| Board id | Intent | Effect of this doc |
|---|---|---|
| **#27** | Authorized v0.3 demo/pilot scope | Scope written → **Review** until Audio signs Stage A+ |
| **V-02** | Demo / feature cut | Frozen Path B + Path A intermediate → **Done** (docs) |
| **V-03** | Acceptance gates documented | §4 written → **Done** (docs) |
| Deploy / live tasks | Staging/prod / live adapters | Remain blocked until matching §5 auths — **do not mark Done** |

---

*Documentation only. No code, schema, secrets, accounts, or deploys are authorized by this file.*
