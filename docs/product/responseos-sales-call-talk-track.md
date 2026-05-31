# ResponseOS Sales Call Talk Track

**Owner:** AJ Digital LLC / Audio Jones
**Product Family:** ResponseOS / Founder Intelligence Systems™
**Status:** Sales Call Talk Track Specification
**Scope:** Documentation and sales-enablement copy only

**Related Docs:**
- [`responseos-demo-landing-page-copy.md`](./responseos-demo-landing-page-copy.md)
- [`responseos-demo-narrative-and-asset-plan.md`](./responseos-demo-narrative-and-asset-plan.md)
- [`responseos-screen-wireframe-spec.md`](./responseos-screen-wireframe-spec.md)
- [`demo-assets/README.md`](./demo-assets/README.md)

> Documentation / sales-enablement only. **No UI, routes, components, runtime code, app metadata,
> provider integrations, deps, env vars, secrets, migrations, or deploy changes.** This is the spoken
> bridge from the landing-page copy to a live conversation. Brand 2.0 voice (ADR-0021); communications
> canon (ADR-0031–0034); Business Memory stays Phase-1 event-ledger capture (ADR-0034).

This talk track is the bridge in the spec stack:

```
Product Doctrine → Demo Narrative → Demo Assets → Wireframes → Landing Page Copy → Sales Conversation
```

---

## Table of contents

1. [Executive summary](#1-executive-summary)
2. [How to use this talk track](#2-how-to-use-this-talk-track)
3. [Call structure at a glance](#3-call-structure-at-a-glance)
4. [Stage 1 — Open](#4-stage-1--open)
5. [Stage 2 — Discovery](#5-stage-2--discovery)
6. [Stage 3 — Frame the revenue leak](#6-stage-3--frame-the-revenue-leak)
7. [Stage 4 — Demo walkthrough narration](#7-stage-4--demo-walkthrough-narration)
8. [Stage 5 — Business Memory & Founder Intelligence](#8-stage-5--business-memory--founder-intelligence)
9. [Stage 6 — Objection handling](#9-stage-6--objection-handling)
10. [Stage 7 — Close & next steps](#10-stage-7--close--next-steps)
11. [Qualification / disqualification](#11-qualification--disqualification)
12. [Language do / don't](#12-language-do--dont)
13. [Non-goals](#13-non-goals)
14. [Open decisions](#14-open-decisions)
15. [Success criteria](#15-success-criteria)
16. [Suggested follow-up tasks](#16-suggested-follow-up-tasks)

---

## 1. Executive summary

This document is a **spoken talk track** for live ResponseOS sales / diagnostic calls. It turns the
landing-page copy into a conversation that leads with the prospect's **revenue leak**, narrates the
**revenue recovery loop** on the demo, and closes on a **business outcome** — not an AI feature.

The rep's job on the call: **make the leak real, show the loop, and book the next step.** ResponseOS is
positioned as a **revenue recovery / founder intelligence system** — the AI receptionist is the wedge,
not the pitch.

## 2. How to use this talk track

- It's a **track, not a script** — say it in your own words; keep the *order* and the *framing*.
- **Listen more than you talk** in Discovery; the prospect's own numbers do the selling.
- Keep vendor names (Telnyx, Vapi, HubSpot) **off the table** unless asked — they're infrastructure.
- Describe **Business Memory as captured context**, never as "RAG," "vectors," or "AI brain."
- Anchor with the demo scenario from [`demo-assets/`](./demo-assets/README.md) (after-hours
  accessibility-equipment call) when a concrete example helps.
- **Brackets `[ ]`** mark where to insert the prospect's own details.

## 3. Call structure at a glance

| Stage | Goal | Time |
|---|---|---|
| 1. Open | Set the frame, earn the next 20 minutes | ~2 min |
| 2. Discovery | Surface the leak in *their* numbers | ~8 min |
| 3. Frame the leak | Quantify what's slipping | ~3 min |
| 4. Demo walkthrough | Show the recovery loop end-to-end | ~8 min |
| 5. Memory + Intelligence | Show context capture + the founder briefing | ~4 min |
| 6. Objections | Clear the path | ~3 min |
| 7. Close | Book the next step | ~2 min |

## 4. Stage 1 — Open

> "Thanks for the time. I'll keep this useful — quick goal for today: figure out whether you're losing
> revenue to **missed calls and slow follow-up**, and if so, show you exactly how we catch it. If it's
> not a fit, I'll tell you. Sound fair?"

> "Before I show you anything — tell me how demand comes into the business today. Mostly phone? Web?
> Referrals?"

*(Goal: permission + a frame where the product is the answer to a problem they confirm, not a feature
demo.)*

## 5. Stage 2 — Discovery

Ask, then **shut up and listen**. Write their numbers down — you'll use them in Stage 3.

- "Roughly how many inbound calls a week — and honestly, how many get missed or go to voicemail?"
- "What happens to a missed call right now? Who calls them back, and how fast?"
- "After-hours and weekends — what catches those?"
- "When a lead does come in, where does it land? A CRM, a notebook, a text thread?"
- "Are you on **HubSpot, GoHighLevel**, something else, or nothing yet?" *(infra check, not a pitch)*
- "What's a typical job worth to you — and your bigger ones?"
- "When was the last time you found out *after the fact* that a good lead slipped?"

*(Listen for: missed-call volume, slow/forgotten follow-up, incomplete CRM, no after-hours coverage,
high job value. Each one is a leak you'll name in Stage 3.)*

## 6. Stage 3 — Frame the revenue leak

Reflect their own numbers back as money:

> "So you're getting [N] calls a week, missing about [M], each job's worth [\$X]. Even if half of those
> were real, that's [\$ leak] walking out the door **before anyone's even quoted the work.** The problem
> isn't that customers aren't calling — it's that the intent disappears between the call, the CRM, the
> follow-up, and your memory."

> "Here's the part that stings: you usually can't *see* the leak. It's the call that never got logged
> and the follow-up nobody remembered. That's exactly what ResponseOS is built to close."

## 7. Stage 4 — Demo walkthrough narration

Narrate the recovery loop (mirrors the demo narrative + wireframe screens). Use the anchor scenario if
useful.

> "Let me show you the loop. **A high-intent lead calls after hours** — the kind that normally hits
> voicemail. Say it's [a wheelchair-ramp emergency after a hospital discharge]."

1. **Answer / recover.** "ResponseOS answers, or recovers the missed call — the lead isn't lost."
2. **Qualify.** "It qualifies the caller: service area, urgency, decision-maker, intent."
3. **Capture.** "It captures the need — service, urgency, timeline, appointment intent — in structured
   form, not a voicemail you have to decode."
4. **CRM sync.** "Your CRM updates itself — contact, activity, and an opportunity, no copy-paste." *(If
   they're on HubSpot: "lands right in HubSpot." If GHL: "works with GoHighLevel too.")*
5. **Founder view.** "And here's what you'd see [point to Revenue Recovery Overview]: the recovered
   opportunity, what it's worth, and the **one next action** — call back to confirm the assessment."

> "That whole loop ran without you touching anything. The call that used to leak is now a tracked
> opportunity with a next step."

## 8. Stage 5 — Business Memory & Founder Intelligence

> "Two things that make this more than an answering service."

**Business Memory:** "It doesn't just answer — it **remembers what happened.** The transcript, the
summary, the intent, the urgency, the next action — all captured so your team picks up exactly where the
caller left off. *(Phase 1 is structured capture — not some black-box AI memory; the deeper stuff is
deliberately gated for later.)*"

**Founder Intelligence:** "And you get a daily briefing — **what changed, what matters, who needs
attention, where money's leaking, and what to do next.** Revenue protected today, leads requiring
action, follow-ups due, at-risk opportunities. You run the business *to* the briefing instead of *from*
memory."

## 9. Stage 6 — Objection handling

Mapped to the landing-page FAQ. Keep answers short and outcome-first.

- **"Isn't this just an AI receptionist?"** → "Answering's the wedge. The value is recovered revenue,
  the CRM staying current, and you seeing what to do next. The receptionist is step one of six."
- **"Will it replace my CRM?"** → "No — your CRM stays the system of record. We keep it *complete*
  instead of half-filled."
- **"Does it work with HubSpot / GoHighLevel?"** → "HubSpot's the default, and GHL is supported. You're
  not locked into any one phone or CRM vendor — that's by design."
- **"What happens after the call?"** → "Lead qualified, CRM updated, context captured, next action in
  your follow-up queue."
- **"Is the demo real customer data?"** → "No — clearly-labeled mock data only. No real customer or
  personal info."
- **"Is it live or simulated?"** → "Today it's a guided walkthrough on mock data." *(Recorded vs
  clickable is an [open decision](#14-open-decisions) — don't overpromise.)*
- **"Is the advanced AI memory active now?"** → "No — Phase 1 is structured event capture. The advanced
  retrieval is intentionally gated for a later phase. I'd rather under-promise there."
- **"What's it built on?"** *(only if asked)* → "Modern communications, CRM sync, and event capture
  behind a provider abstraction so you're never trapped in one vendor. Happy to go deeper if it
  matters, but it's plumbing — the point is the recovered revenue."

## 10. Stage 7 — Close & next steps

> "Based on what you told me — [N missed calls], [\$X jobs] — this looks like a real leak we can close.
> The next step is a **[CTA]** where we map exactly where your revenue's slipping and what catching it
> is worth. Want me to get that booked?"

Primary close options (final wording is an [open decision](#14-open-decisions)):
- **Book a Revenue Recovery Demo**
- **Revenue Memory Diagnostic**
- **Audit My Missed Revenue**

> "I'll send a calendar link and a one-pager. Anything you want me to make sure we cover when we walk
> through your numbers?"

*(Always leave with a booked time or a clear, dated next step.)*

## 11. Qualification / disqualification

**Good fit:** founder-led service business · meaningful inbound call volume with real misses · job value
that makes recovery worth it (~\$300+ typical) · weak/forgotten follow-up · owner who feels the pain ·
CRM/calendar access · low compliance risk.

**Disqualify or defer:** no phone-driven demand · negligible job value · heavily regulated intake the
demo can't responsibly serve · no owner buy-in. Say so honestly — it builds trust and protects pipeline.

## 12. Language do / don't

| Do say | Don't say |
|---|---|
| Recovered revenue · revenue leak · qualified opportunity | "AI magic" · "powered by AI" as the pitch |
| Captured context / business memory | RAG · vectors · embeddings · "AI brain" |
| Updates your CRM automatically | provider/vendor names as the headline |
| What happened, what matters, what to do next | "set it and forget it" |
| The receptionist is the wedge | "AI receptionist" as the product |

## 13. Non-goals

- Do **not** implement any UI, route, or demo experience in this task.
- Do **not** add provider integrations or credentials.
- Do **not** expose Telnyx, Vapi, or HubSpot as the primary selling point.
- Do **not** imply full RAG / vector / per-tenant knowledge automation is active.
- Do **not** promise a live/clickable demo before that format is decided.
- Do **not** resolve the OpenAI-inside-Vapi or gateway/Redis architecture decisions.

## 14. Open decisions

- **Final primary CTA wording:** Revenue Recovery Demo · Revenue Memory Diagnostic · Missed Revenue Audit.
- **Anchor vertical** for the standard pitch: accessibility / mobility · home services · HVAC · multi-vertical.
- **Demo format** referenced on the call: recorded · clickable · hybrid.
- Whether **pricing** is discussed on the first call or held for a follow-up.
- **(Architecture — preserved)** Whether **OpenAI remains the LLM brain inside Vapi.** (ADR-0032)
- **(Architecture — preserved)** Whether the **Node.js voice gateway + Redis (ADR-0013/0014)** survive behind/alongside Vapi. (ADR-0032)

## 15. Success criteria

- A sales-call talk track document exists.
- It positions ResponseOS as revenue recovery / founder intelligence, not commodity AI receptionist software.
- It covers open, discovery, leak framing, demo narration, memory/intelligence, objections, and close.
- Objection handling maps to the landing-page FAQ and stays canon-aligned.
- Business Memory is described as Phase-1 structured capture only.
- Open decisions remain explicit.
- Cross-links are added from related product docs.
- No UI / runtime code is changed.

## 16. Suggested follow-up tasks

1. Create a **one-page sales cheat sheet** (talk track condensed to a single reference card).
2. Create **OG / social preview copy + image spec.**
3. Decide the **final primary CTA language.**
4. Decide the **primary vertical** for the standard pitch.
5. Decide the **demo format** (recorded / clickable / hybrid) referenced on calls.

---

*ResponseOS Sales Call Talk Track — documentation / sales-enablement only. Brand 2.0 (ADR-0021) +
communications canon (ADR-0031–0034) respected; Business Memory Phase-1 event-ledger only (ADR-0034);
open decisions preserved.*
