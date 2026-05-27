# ResponseOS — Market Research

**Owner:** AJ Digital LLC / Audio Jones
**Status:** Draft v0.1 — research input, not a committed plan. Numbers are either sourced (cited inline) or flagged `(Assumption — validate)`.
**Last updated:** 2026-05-27
**Companion docs:** [`../PRD.md`](../PRD.md) · [`../product-spec.md`](../product-spec.md) · [`../pricing-and-onboarding.md`](../pricing-and-onboarding.md) · [`./RESPONSEOS_COMPETITOR_RESEARCH.md`](./RESPONSEOS_COMPETITOR_RESEARCH.md) · [`./RESPONSEOS_NAMING_RISK_RESEARCH.md`](./RESPONSEOS_NAMING_RISK_RESEARCH.md)

> **Integrity note.** This document does not assert a hard market size as fact. It gives a sizing **method** and a worked **illustrative** example whose every input is labeled as an assumption requiring primary validation. Verified figures are cited with the source actually retrieved and the date/vintage of the data. Treat any uncited number as an assumption to be validated before it goes into a deck or a contract.

---

## 1. Purpose and scope

This is the market-side research input for ResponseOS: who the buyer is, the job they are hiring the product to do, how the market segments, how to size it credibly, what is driving demand, how the buyer buys, what the pricing landscape looks like, and what could go wrong. It deliberately separates **what we verified** from **what we are assuming**.

It is research, not strategy commitment. The product definition lives in [`../PRD.md`](../PRD.md). The commercial motion lives in [`../pricing-and-onboarding.md`](../pricing-and-onboarding.md).

---

## 2. Market framing — the problem and the job to be done

### The problem

Founder-led service businesses lose revenue at the **moment of demand** more than at the moment of marketing. The leak is structural, not a campaign problem:

- Inbound calls go unanswered because the owner or crew is on a job.
- After-hours and weekend demand hits voicemail and never converts.
- Web-form and SMS leads sit for hours before anyone follows up.
- Quotes and callbacks slip because follow-up is manual (a sticky note, a Google Sheet, "I'll call them back").
- Nobody can prove how much was lost, so nobody can prioritize fixing it.

The economic point: for a phone-driven trade, a missed call is often a missed job, and a missed job at a `(Assumption — validate)` typical ticket of a few hundred to a few thousand dollars is a direct revenue event, not a soft marketing metric.

### The job to be done (JTBD)

> "When demand comes in and I can't personally catch it, capture it, qualify it, follow up, book it, and **show me what it was worth**, so I stop bleeding revenue I already paid marketing to generate."

Note the last clause. The buyer can already get "answer the phone" from cheaper point tools (see [`./RESPONSEOS_COMPETITOR_RESEARCH.md`](./RESPONSEOS_COMPETITOR_RESEARCH.md)). The under-served part of the job is **qualify → route → follow up → book → prove ROI** as one accountable system. That is the wedge ResponseOS is built on, mapped internally to the RECOVER framework (Respond, Evaluate, Capture, Offer, Verify, Escalate, Report) in [`../PRD.md`](../PRD.md).

### The buyer

- **Who:** Owner/operator of a founder-led service business (or their office manager). Phone-driven demand.
- **Qualification gates** (from [`../PRD.md`](../PRD.md) / [`../pricing-and-onboarding.md`](../pricing-and-onboarding.md)): ~$300+ average job value, ~20+ missed calls/month, a clear booking/quote process, owner buy-in, CRM/calendar access (often GoHighLevel or HubSpot), low compliance risk, a measurable ROI path.
- **Emotional driver:** the owner *feels* missed demand but cannot quantify it and does not want to hire and manage a 24/7 front office.

---

## 3. Market segmentation

### 3.1 By vertical

| Vertical | Phase | Why it fits | Notable nuance |
|---|---|---|---|
| **Home services** — HVAC, roofing, plumbing, electrical, landscaping, general contracting | **Primary / now** | High ticket, phone-driven, emergency/after-hours demand, owner-operated, often already on a CRM | Seasonality (HVAC peaks, roofing storm cycles) `(Assumption — validate)` |
| Med spas | Later | High ticket, booking-driven, marketing spend already high | Health-adjacent → consent/recording + privacy posture matters; **not HIPAA-certified** (see [`../SECURITY.md`](../SECURITY.md)) |
| Auto repair | Later | High call volume, appointment-based | Lower average ticket than HVAC/roofing `(Assumption — validate)` |
| Real estate | Later | Speed-to-lead is the entire game | TCPA/Do-Not-Call exposure on outbound is higher `(Assumption — validate)` |
| Legal / medical | Compliance-gated | High value per lead | Gated until compliance lanes are in force; treat as out-of-scope for early GTM |

### 3.2 By business size

| Tier | Shape | Fit |
|---|---|---|
| Solo / 1–3 person | Owner answers own phone; minimal tooling | Real pain, but low ACV and high churn risk `(Assumption — validate)`; may be better served by a cheap point tool |
| **Founder-led SMB (4–25)** | Owner + small crew + maybe an office manager; CRM in place | **Core ResponseOS buyer** |
| Lower mid-market (25–100+) | Multiple trucks/crews, dispatch, possibly an FSM like ServiceTitan | Fit, but more procurement friction and existing tooling to integrate around |
| Multi-location / franchise | Centralized ops | White-label / multi-tenant story is strongest here, but longer sales cycle |

### 3.3 By current tooling maturity

| Maturity | Signal | ResponseOS angle |
|---|---|---|
| **Unstructured** | Cell phone + voicemail + paper | Highest pain, lowest readiness — Phase 1 assessment likely returns "not yet ready" |
| **Point tools** | Missed-call-text-back app, a calendar, a quoting doc | The orchestration gap is obvious; strongest "stop the leak" story |
| **CRM-equipped** | On GoHighLevel or HubSpot but underusing it | **Best fit** — ResponseOS orchestrates above the CRM and proves ROI |
| **FSM-equipped** | ServiceTitan / Housecall Pro / Jobber in place | Integration target; ResponseOS is the response/accountability layer, FSM is system of record downstream |

---

## 4. TAM / SAM / SOM — method first, numbers as illustration

> **Do not lift these numbers into a pitch as fact.** This section exists to make the *method* auditable. The only hard inputs are the cited business-count figures; everything labeled `(Assumption — validate)` must be replaced with primary data before use.

### 4.1 Verified anchor inputs (with sources and vintage)

- **~990,000 plumbing & HVAC contractor establishments in the U.S. (2020).** Source: Statista, "Number of plumbing & HVAC contractor SMBs by firm size, U.S. 2020." Vintage 2020 — re-pull for current year before relying on it. (Retrieved 2026-05-27.) https://www.statista.com/statistics/1122362/number-plumbing-hvac-contractor-smbs-firm-size-us/
- **~2.5 million home service businesses in the U.S. (broad definition incl. plumbing, HVAC, electrical, and others).** Source: Valve+Meter, "How Many Home Services Professionals Are There In the US." This is a third-party blog aggregating industry data — treat as directional and re-verify against Census County Business Patterns / IBISWorld. (Retrieved 2026-05-27.) https://valveandmeter.com/blog/marketing/how-many-home-services-professionals-us/
- **Heating & A/C contractors business counts** are tracked by IBISWorld (figure not transcribed here to avoid mis-citation; pull the exact current number directly). https://www.ibisworld.com/united-states/number-of-businesses/heating-air-conditioning-contractors/1945/

> Caveat: "establishments" ≠ "companies" ≠ "qualified buyers." A single firm can have multiple establishments; many establishments fall below the ResponseOS qualification gates. Apply a qualification filter, do not use raw counts as TAM.

### 4.2 Sizing method

A bottom-up, attach-rate model is more defensible than a top-down "X% of a big number":

```
TAM (annual recurring revenue potential)
  = (# of qualifying service businesses in scope)
  × (annual contract value, ACV, of a typical ResponseOS engagement)

SAM (serviceable, available)
  = TAM
  × (% reachable via current GTM channels — agencies, referrals, marketplaces)
  × (% in launch verticals/geographies)
  × (% meeting qualification gates: $300+ ticket, 20+ missed calls/mo, CRM in place)

SOM (serviceable, obtainable, ~24-36 mo)
  = SAM
  × (realistic share given sales capacity, churn, and competition)
```

ACV itself should be modeled from the actual commercial structure in [`../pricing-and-onboarding.md`](../pricing-and-onboarding.md), not guessed:

```
ACV ≈ Phase 1 assessment ($1,000, one-time)         [verified from pricing doc]
    + (monthly retainer × 12)                         (Assumption — validate tier mix)
    + (setup fee, one-time, amortized)                (Assumption — validate)
    + (expected outcome fees on verified results)     (Assumption — validate; depends on attach + realized ROI)
```

### 4.3 Worked illustrative example (every input is an assumption)

> The point of this table is the **arithmetic chain**, not the result. Replace each assumption with primary data.

| Input | Illustrative value | Status |
|---|---|---|
| Qualifying U.S. home-services firms (HVAC/roofing/plumbing/electrical, meeting gates) | 250,000 | `(Assumption — validate)` — derive from Census/IBISWorld with a qualification filter, not from raw 990k/2.5M counts |
| Reachable share via initial GTM | 15% | `(Assumption — validate)` |
| Launch-vertical / geography filter | 60% | `(Assumption — validate)` |
| Effective serviceable firms (SAM base) | 250,000 × 15% × 60% = 22,500 | derived |
| Blended ACV (retainer-led, year 1) | $18,000 | `(Assumption — validate)` — must be modeled from real tier mix in pricing doc |
| **Illustrative SAM (ARR)** | 22,500 × $18,000 ≈ **$405M** | **illustrative only — not a claim** |
| Obtainable share, 24–36 mo | 1% | `(Assumption — validate)` |
| **Illustrative SOM (ARR)** | $405M × 1% ≈ **$4M** | **illustrative only — not a claim** |

Sensitivity matters more than the point estimate: at this scale, SOM swings by millions on a one-point change in attach rate or ACV. The validation plan in §10 exists to turn these assumptions into ranges with confidence intervals.

---

## 5. Demand drivers and trends

Framed qualitatively. Any specific percentage or growth figure below is `(Assumption — validate)` unless cited.

- **AI voice agents have crossed the usability line.** Realtime voice (sub-second latency, natural turn-taking) is now a productized capability from multiple vendors, lowering the cost of "answer every call." Directional support: the 2026 voice-platform comparisons of Retell/Vapi/Bland describe sub-500ms–900ms latencies as current table stakes. (Retrieved 2026-05-27.) https://www.retellai.com/blog/best-voice-ai-providers
- **Missed-call-text-back is becoming table stakes, not a differentiator.** It now ships inside mainstream CRMs. Example: GoHighLevel bundles missed-call-text-back into its base plans with no add-on fee. (Retrieved 2026-05-27.) https://help.gohighlevel.com/support/solutions/articles/155000006652-ai-product-pricing — Strategic implication: ResponseOS must compete *above* this commoditized layer, on orchestration + ROI, not on the text-back feature itself.
- **Front-office labor is scarce/expensive for SMB trades.** `(Assumption — validate)` Owners report difficulty staffing reliable phone coverage; AI is positioned as capacity, not headcount. Validate with primary interviews; do not cite a hard labor-shortage statistic without a source.
- **Outcome-based pricing appetite is rising but unproven for this buyer.** `(Assumption — validate)` The thesis that owners will pay outcome fees on *verified* recovered revenue is core to ResponseOS economics and is the single most important assumption to test in the field.
- **CRM consolidation (esp. GoHighLevel) in the SMB-services + agency channel** creates a natural integration surface and a natural channel. Directional, validate the install-base concentration.

---

## 6. Buyer behavior

How founder-led service businesses actually buy software (synthesized; validate via interviews — see §10):

- **Trust over features.** They buy from people and proof, not spec sheets. Referrals, peer word-of-mouth, and trade communities dominate. `(Assumption — validate)`
- **Skeptical of "AI" hype** after being burned by tools they bought and never used. The paid Phase 1 assessment is partly a trust mechanism: it shows proof before asking for commitment.
- **Decision criteria (hypothesized):** "Will it actually pick up my calls?", "Will it sound like a robot and embarrass me?", "Will it dump into my existing CRM or create another silo?", "Can you *show* me it made me money?", "How much hand-holding does it need?"
- **Switching costs are emotional and operational, not contractual.** Re-training staff, re-pointing phone numbers, and trust in a new "voice" of the business are the real friction — not data export.
- **Channels:** agencies and done-for-you shops (who resell/install), peer referrals, and CRM/FSM marketplaces. The agency channel is both a distribution opportunity and a competitive set (see [`./RESPONSEOS_COMPETITOR_RESEARCH.md`](./RESPONSEOS_COMPETITOR_RESEARCH.md)).

---

## 7. Pricing landscape

> All ranges below are **approximate and need validation** unless a specific source is cited. Vendor pricing changes frequently; re-pull before quoting.

| Category | Typical price shape | Source / status |
|---|---|---|
| CRM with built-in AI / text-back (e.g., GoHighLevel) | Plans observed at $97 / $297 / $497 per month tiers; Voice AI ~$0.13/min or ~$97/mo unlimited; missed-call-text-back bundled | Verified structure (Retrieved 2026-05-27) https://help.gohighlevel.com/support/solutions/articles/155000006652-ai-product-pricing — re-verify exact current figures |
| AI receptionist / answering-service point products | Monthly subscription and/or per-minute/per-call | `(Assumption — validate)` — pricing varies widely; pull current published pricing per vendor |
| Voice-agent dev platforms (Retell / Vapi / Bland) | Per-minute usage, varies by stack and volume | Directional only; per-minute economics confirmed as the model, exact rates vary (Retrieved 2026-05-27) https://www.retellai.com/blog/best-voice-ai-providers |
| FSM platforms (ServiceTitan / Housecall Pro / Jobber) | Seat/subscription, often higher and contract-based | `(Assumption — validate)` |
| Agencies / done-for-you AI automation shops | Setup fee + monthly retainer; wide range | `(Assumption — validate)` |

### ResponseOS positioning against this landscape

ResponseOS is intentionally **not** priced as a per-minute utility or a cheap app. Its model (see [`../pricing-and-onboarding.md`](../pricing-and-onboarding.md)):

1. **Phase 1 — Readiness & Revenue Leak Assessment:** $1,000 flat ($750–$1,500 range), optionally credited toward implementation. *Verified from the pricing doc.* This is a deliberate qualification + trust gate that point tools and most agencies do not run.
2. **Phase 2 — Implementation + monthly retainer** (Recovery Core / Pro / Performance) **+ optional outcome fees on verified results.** Outcome fees are upside, never the whole deal; performance-only pricing is explicitly not offered.

The differentiator is not price point, it is **accountability**: ResponseOS sells proven recovered revenue, sitting above bought infrastructure (Twilio, Grok Voice primary / OpenAI Realtime fallback) and below the client's CRM/FSM.

---

## 8. Risks and headwinds

| Risk | Description | Severity (illustrative) |
|---|---|---|
| **Voice-agent commoditization** | The "answer the phone" capability is racing toward zero margin and ships free in CRMs. If ResponseOS is perceived as "just an AI receptionist," it loses. | High |
| **Platform / provider risk** | Heavy reliance on Grok Voice (primary), OpenAI Realtime (fallback), Twilio, HubSpot. Pricing, API, or availability changes hit margin and reliability. Mitigated by provider-adapter pattern (see [`../architecture.md`](../architecture.md)). | High |
| **Compliance** | TCPA (outbound/SMS), call-recording consent (two-party-consent states), and health-adjacent verticals. ResponseOS is **not HIPAA-certified** ([`../SECURITY.md`](../SECURITY.md)); compliance-gated verticals are out of early scope. | High |
| **AI trust / skepticism** | Owners fear an AI "voice of the business" sounding robotic or mishandling a customer. | Medium–High |
| **Outcome-fee disputes** | If "verified recovered revenue" is contestable, outcome fees create friction. Attribution rigor (the event ledger) is the defense. | Medium |
| **CRM/voice platforms moving up the stack** | A GoHighLevel or a Retell could add orchestration + reporting and squeeze the layer. (Detailed in competitor doc.) | Medium–High |
| **Channel dependence** | Over-reliance on the agency channel cedes margin and the customer relationship. | Medium |

---

## 9. Go-to-market implications

- **Lead with the leak, not the feature.** The Phase 1 assessment quantifies the problem in dollars before selling a solution. This is the antidote to commoditization.
- **Anchor on ROI proof.** The reporting/attribution layer (canonical event ledger → recovered-revenue reporting) is the product's reason to exist and its pricing justification.
- **Pick a beachhead vertical and win it visibly.** Home services first; reference-able local wins compound in trust-driven, referral-led markets.
- **Treat agencies as a channel *and* a competitor.** A white-label/partner motion can turn the closest GTM competitor into distribution.
- **Integrate, don't replace, the CRM.** "Works with your GoHighLevel/HubSpot" lowers switching cost and reframes ResponseOS as the accountability layer, not another silo.

---

## 10. Open questions / primary research to run

Concrete, runnable validation work. Each item replaces one or more `(Assumption — validate)` flags above.

1. **Qualifying-firm count.** Pull U.S. Census County Business Patterns + IBISWorld by NAICS for HVAC, plumbing, electrical, roofing, landscaping; apply a qualification filter (employee size as a proxy for the $300+ ticket / 20+ missed calls / CRM-in-place gates). Replaces the §4.3 firm-count assumption.
2. **ACV model.** Build ACV bottom-up from real tier mix once Phase 2 has live customers; until then, model a low/base/high range from [`../pricing-and-onboarding.md`](../pricing-and-onboarding.md). Replaces the §4.2 ACV assumption.
3. **Owner interviews (n≥15–20).** Structured interviews with founder-led home-services owners: missed-call volume, average ticket, current follow-up process, willingness to pay, willingness to pay *outcome fees*, AI trust. Replaces §5–§6 buyer-behavior assumptions.
4. **Outcome-fee acceptance test.** Run the outcome-fee structure past real prospects; measure objection rate and what "verified" must mean to them. This is the highest-leverage validation.
5. **Competitor pricing pull.** Refresh §7 with current published pricing for AI receptionists, voice platforms, FSMs, and a sample of agencies. Date-stamp everything.
6. **Channel test.** Pilot one agency partnership and one direct-referral motion; compare CAC, close rate, and margin retention.
7. **Compliance per-vertical brief.** Document TCPA, recording-consent, and privacy posture per launch vertical with counsel before outbound or med-spa expansion. Coordinate with [`../SECURITY.md`](../SECURITY.md).

---

## 11. Assumptions (consolidated)

Everything in this list is **unverified** and must not be presented as fact:

- The ResponseOS buyer is reachable in volume via agencies, referrals, and CRM/FSM marketplaces.
- Founder-led service owners will pay a recurring retainer (not just a cheap per-minute tool) for an accountability layer.
- Outcome-based fees on *verified* recovered revenue are commercially acceptable to this buyer.
- A meaningful share of home-services firms meet the qualification gates ($300+ ticket, 20+ missed calls/mo, CRM in place).
- Front-office labor scarcity is a durable demand driver for this segment.
- All §4.3 worked-example inputs (firm count, reachable %, vertical filter, ACV, obtainable share).
- All §7 pricing ranges not explicitly cited.
- Seasonality and average-ticket characterizations per vertical.

## 12. What we verified (and its limits)

- **Business counts** for plumbing/HVAC (~990k establishments, 2020 vintage) and broad home services (~2.5M, third-party aggregation). Retrieved 2026-05-27. Limits: vintage, "establishment ≠ qualified buyer," and one source is a marketing blog — re-verify against Census/IBISWorld.
- **GoHighLevel pricing structure** (tiered plans; bundled missed-call-text-back; per-minute Voice AI). Retrieved 2026-05-27. Limit: vendor pricing changes; treat exact figures as a snapshot.
- **Voice-platform landscape** (per-minute economics, latency as table stakes, Retell/Vapi/Bland positioning). Retrieved 2026-05-27. Limit: comparison content is partly vendor-published; directional only.
- The **ResponseOS commercial model** ($1,000 Phase 1; Phase 2 retainer + optional outcome fees) is verified against this repo's own [`../pricing-and-onboarding.md`](../pricing-and-onboarding.md) and [`../PRD.md`](../PRD.md).

> Sources retrieved 2026-05-27:
> - Statista — plumbing & HVAC contractor SMBs by firm size, US 2020: https://www.statista.com/statistics/1122362/number-plumbing-hvac-contractor-smbs-firm-size-us/
> - Valve+Meter — how many home services professionals in the US: https://valveandmeter.com/blog/marketing/how-many-home-services-professionals-us/
> - IBISWorld — heating & A/C contractors, number of businesses: https://www.ibisworld.com/united-states/number-of-businesses/heating-air-conditioning-contractors/1945/
> - GoHighLevel — AI product pricing: https://help.gohighlevel.com/support/solutions/articles/155000006652-ai-product-pricing
> - Retell AI — best voice AI providers (landscape, directional): https://www.retellai.com/blog/best-voice-ai-providers
