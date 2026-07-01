# RESPONSEOS_BRAND_VOICE.md — Voice, Tone & Language System

**Product:** ResponseOS
**Owner:** AJ Digital LLC / Audio Jones
**Status:** Canonical brand doc. Source of truth for how ResponseOS sounds across every surface. Update via PR.
**Companion docs:** [`./RESPONSEOS_POSITIONING.md`](./RESPONSEOS_POSITIONING.md) · [`./RESPONSEOS_SALES_NARRATIVE.md`](./RESPONSEOS_SALES_NARRATIVE.md) · [`./RESPONSEOS_WEBSITE_COPY_SPEC.md`](./RESPONSEOS_WEBSITE_COPY_SPEC.md) · [`../DESIGN.md`](../DESIGN.md) (UX Writing Rules)

---

## Purpose

This document defines the ResponseOS voice: who we sound like, the exact words we use and avoid, and how the tone shifts by surface. It expands the UX Writing Rules in [`../DESIGN.md`](../DESIGN.md) into the full brand-voice contract. If marketing, product, and sales copy disagree, this file wins on voice.

---

## 1. Voice principles

1. **The product is recovered revenue. AI is the mechanism.** Never center the AI over the business outcome.
2. **Sound like a senior revenue analyst, not a startup pitching features.** Calm, precise, numerate, confident without hype.
3. **Outcome-first.** Lead with what the owner gets (recovered revenue, booked work, hours saved), not with how it works.
4. **Plain business language on client-facing surfaces.** No technical jargon where an owner or office manager will read it.
5. **Measurable over evocative.** Prefer a number or a verifiable claim to an adjective.
6. **Restraint.** Borrow Apple's precision, Linear's opinionated clarity, Palantir's operational seriousness. Say less, mean more.
7. **Never overclaim.** No fabricated stats, no fake logos, no compliance claims we cannot back. **ResponseOS is not HIPAA-certified** — never imply otherwise.

---

## 2. The persona — "the senior revenue analyst"

When in doubt, write as if a senior revenue analyst is briefing the owner of the business.

- They respect the owner's time and intelligence.
- They speak in outcomes and numbers, not features and buzzwords.
- They are confident because they have the data, not because they are excited about technology.
- They never blame the owner or the customer.
- They explain the *why* behind a number, then point to the next action.

They are **not**: a hype marketer, a chatbot, a "growth hacker," or an AI evangelist.

---

## 3. The Use → Avoid lexicon

This is load-bearing. The left column is canonical ResponseOS language; the right column is off-brand and must not ship on any surface.

| Use | Avoid | Why |
|---|---|---|
| Recovered Revenue | AI-Generated Revenue | The business recovers revenue; the AI didn't "generate" it |
| Qualified Leads | Smart Leads / AI Leads | The lead quality is the point, not the AI |
| Booked Opportunities | Wins / Converted AI Contacts | Operational, neutral, countable |
| Needs Review | Flagged by Bot | Describes the state, not the actor |
| Escalated | AI Couldn't Handle | Escalation is a designed path, not a failure |
| Verified Outcome | AI Confirmed | Verification is a business fact, not an AI claim |
| Missed Demand | Lost Leads | "Demand" reframes it as recoverable, not gone |
| Response Speed | AI Speed | The owner cares about response time, not the AI |
| Recovery loop / RECOVER | Magic / black box | Name the mechanism plainly |
| Captured every demand signal | Bot answered everything | Coverage is the claim, not bot heroics |
| Under 60 seconds | Instant / real-time-AI | Specific, verifiable |
| Reports recovered revenue monthly | Powered by AI | Lead with proof, not the engine |
| AI voice agent (mechanism) | Autonomous super agent | Honest description of a tool |
| Founder-led service business | SMB / mom-and-pop | Respectful, specific to ICP |
| Operator console / client portal | Dashboard (generic) | Name the surface precisely |

### Banned outright (any surface)

- "AI magic"
- "Autonomous super agent"
- "Set it and forget it"
- "Bot handled everything"
- "Powered by AI" **as a headline**
- Glowing-brain / neural-network / robot imagery and the language that goes with it
- Any phrasing that centers the AI over the business outcome

### Banned on client-facing surfaces specifically

No internal/technical jargon where an owner or office manager reads it: **"webhook," "qualifier score," "route engine," "state machine," "event ledger," "tenant," "adapter."** These are fine in internal docs and the operator console tooltips; they are off-brand in the marketing site, client portal hero copy, and proposals.

---

## 4. Do / Don't — rewrites

Five hypey sentences, rewritten into ResponseOS voice.

| Don't (off-brand) | Do (ResponseOS) |
|---|---|
| "Our AI magic answers every call so you never miss a lead again!" | "Every missed call gets a response in under 60 seconds — and we report how much revenue that recovered." |
| "Set it and forget it — the bot handles everything for you." | "We run the recovery loop for you and send a monthly report showing recovered revenue and ROI." |
| "Powered by next-gen autonomous AI agents." | "An AI voice agent answers, qualifies, and books — using your hours, service area, and pricing rules." |
| "Turn your business into an AI-driven revenue machine!" | "Recover the revenue that's leaking into voicemail, missed calls, and unworked leads." |
| "Smart AI leads delivered straight to your CRM, automatically." | "Qualified leads captured and synced to your CRM, with the recovered revenue tied back to each one." |

---

## 5. Tone by surface

The voice is constant; the register shifts with context.

| Surface | Audience | Register | Notes |
|---|---|---|---|
| **Marketing site** | Owners/operators (cold) | Confident, outcome-led, lightly persuasive | Lead with category + promise; mechanism last. Plain business language only. |
| **Operator console** (`app/(admin)/`) | AJ Digital staff | Dense, precise, operational | Internal jargon permitted in tooltips/labels; still no hype. Palantir-grade seriousness. |
| **Client portal** (`app/(client)/`) | Per-tenant client admins/viewers | Reassuring, numeric, transparent | "Recovered Revenue This Month" hero. Plain business language. Every number explainable. |
| **Sales proposal / assessment** | Owner/operator (warm) | Analyst briefing an owner | Numbers, ranges, fit/no-fit honesty. Use the verbatim assessment paragraph. |
| **Error / empty states** | Any user | Plain, blameless, action-oriented | State what happened, what to do next, never blame the user. |

### Error and empty state patterns (from [`../DESIGN.md`](../DESIGN.md))

- **Error:** State what happened in plain language, state what the user can do, never blame the user.
  Example: *"We couldn't load this lead. Try refreshing, or contact support if this continues."*
- **Empty:** Explain why the view is empty, suggest the next action.
  Example: *"No leads captured yet. Once a missed call is recovered, leads will appear here."*

---

## 6. Naming & capitalization conventions

| Term | Correct form | Notes |
|---|---|---|
| Product name | **ResponseOS** | One word, capital R and OS. Never "Response OS," "ResponseOs," "Response-OS." |
| Company | **AJ Digital LLC** / **Audio Jones** | "AJ Digital" acceptable on second reference. |
| Delivery framework | **RECOVER** | All caps. Stages: Respond · Evaluate · Capture · Offer · Verify · Escalate · Report. |
| Philosophy framework | **OFFER** | All caps. Outcomes First · Front the Work · Framework Driven · Earn on Outcomes · ROI-Aligned Partnerships. |
| Tiers | **Recovery Core**, **Recovery Pro**, **Recovery Performance** | Title case, "Recovery" then tier word. Recovery Pro is the default offer. |
| Phase 1 | **Readiness & Revenue Leak Assessment** | Title case. "the assessment" on later reference. |
| Surfaces | **operator console**, **client portal**, **marketing site** | Lowercase in prose unless starting a sentence. |
| KPI names | Title case as listed in [`./RESPONSEOS_POSITIONING.md`](./RESPONSEOS_POSITIONING.md) §8 | e.g., **Recovered Revenue (verified)**, **ROI Multiple**. |
| Category | **Revenue Recovery Infrastructure** | Title case when used as the category label. |

---

## 7. Grammar & formatting rules

- **Sentence case** for headlines and UI labels except product/framework/tier proper nouns. Avoid Title Case Marketing Headlines.
- **Active voice.** "ResponseOS captures every call," not "every call is captured."
- **Second person** ("you," "your business") on owner-facing surfaces; third person for the product ("ResponseOS reports…").
- **Numerals for measurable claims** (under 60 seconds, 9 KPIs, ~20+ missed calls/month). Spell out only in narrative prose where it reads better.
- **Currency** with no cents in marketing ($1,000, not $1,000.00). Ranges with an en dash ($750–$1,500).
- **Oxford comma** on.
- **No exclamation points** on marketing or client surfaces. Confidence comes from precision, not punctuation.
- **One claim per sentence** in hero and CTA copy.
- **Label illustrative numbers** as "example" or "illustrative" whenever a figure is not a real client result.

---

## 8. Accessibility & plain-language rules

- Target a reading level a busy owner skims comfortably — short sentences, concrete nouns.
- Expand or avoid acronyms on first client-facing use (write "field service management (FSM)" once, then FSM).
- Every metric shown to a client must be explainable in one plain sentence (the analyst can always say what it means and how it was computed).
- Link text describes its destination ("see the pricing tiers"), never "click here."
- Color is never the only signal; Signal Yellow and critical/warning states support, but do not solely carry, meaning. See [`../DESIGN.md`](../DESIGN.md) Accessibility.
- Avoid idioms and regional slang that don't translate cleanly.

---

## 9. Voice review checklist

Before any copy ships, it should pass all of these:

- [ ] Leads with the business outcome, not the AI.
- [ ] Uses the Use column of the lexicon; contains nothing from the Avoid/banned lists.
- [ ] Sounds like a senior revenue analyst briefing an owner.
- [ ] No technical jargon on a client-facing surface.
- [ ] Any number is real, or clearly labeled illustrative/example.
- [ ] No fabricated stats, logos, or testimonials.
- [ ] No HIPAA or compliance claim that isn't true ("not HIPAA-certified").
- [ ] Product/framework/tier names capitalized correctly (§6).
- [ ] Sentence case headlines, active voice, no exclamation points.
- [ ] Register matches the surface (§5).

---

## Assumptions

- The DESIGN.md UX Writing Rules and this doc stay in sync; if they ever diverge, this file is the broader source for voice and DESIGN.md governs in-product UX specifics.
- The dark-first visual system and semantic Signal Yellow discipline are fixed (see [`../DESIGN.md`](../DESIGN.md)); voice does not need to restate visual rules beyond accessibility.

## Open questions

- Do we maintain a separate, looser register for social/short-form, or hold the same restraint everywhere? (Default today: same restraint.)
- For partner/white-label surfaces (Phase 2+), how much of the ResponseOS lexicon do partners inherit vs adapt? (Revisit when white-label ships.)
