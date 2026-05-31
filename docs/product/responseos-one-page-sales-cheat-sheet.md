# ResponseOS One-Page Sales Cheat Sheet

**Owner:** AJ Digital LLC / Audio Jones · **Product Family:** ResponseOS / Founder Intelligence Systems™
**Status:** Sales Cheat Sheet · **Scope:** Documentation / sales-enablement only

> One-page reference distilled from the [talk track](./responseos-sales-call-talk-track.md),
> [landing-page copy](./responseos-demo-landing-page-copy.md),
> [demo narrative](./responseos-demo-narrative-and-asset-plan.md),
> [demo assets](./demo-assets/README.md), and [wireframe spec](./responseos-screen-wireframe-spec.md).
> Copy only — no UI, routes, runtime, or provider integrations. Business Memory = Phase-1 event-ledger
> capture (ADR-0034); Brand 2.0 voice (ADR-0021).

---

## 1. One-sentence positioning

**ResponseOS is a revenue recovery and founder intelligence system that catches the calls you miss,
qualifies the lead, updates your CRM, and shows you what to do next** — the AI receptionist is the
wedge, not the product.

## 2. Ideal buyer

Founder-led service business with **phone-driven demand** — home services, accessibility/mobility
equipment, HVAC, plumbing, roofing, electrical. Small team, real missed calls, weak follow-up, scattered
job context, **~$300+ typical job value**, owner who feels the pain, CRM/calendar access, low compliance
risk. *(Secondary: agencies/consultants, multi-location operators, HubSpot/GHL shops.)*

## 3. Pain symptoms (listen for these)

- Missed calls → missed jobs · voicemails that don't qualify
- Follow-up delayed or forgotten · CRM records half-finished
- No after-hours/weekend coverage · job context trapped in conversations
- Founder can't *see* which opportunities are leaking

## 4. Revenue leak diagnosis formula

```
Calls/week  ×  Miss rate  ×  Avg job value  ×  Realistic close rate  =  Monthly revenue leaking
```

> Reflect *their own* numbers back as dollars: "[N] calls, missing [M], jobs at [$X] — even at half
> real, that's **[$ leak] walking out before anyone's quoted the work.**"

## 5. Core ResponseOS promise

> **The call that used to leak becomes a tracked opportunity with a next step — automatically.**
> Capture the lead → qualify the opportunity → sync the CRM → remember the context → show the founder
> what to do next.

## 6. Demo flow in 6 bullets

1. **High-intent lead calls after hours** (normally → voicemail).
2. **ResponseOS answers / recovers** the missed call.
3. **Qualifies** the caller (service area, urgency, decision-maker, intent).
4. **Captures + syncs to CRM** (service need, urgency, timeline, appointment → HubSpot contact/activity/deal).
5. **Business Memory records the context** (transcript, summary, next action — Phase-1 capture).
6. **Founder dashboard shows** the recovered opportunity, its value, and the **one next action.**

## 7. Discovery questions

- "Calls a week — and how many get missed or go to voicemail?"
- "What happens to a missed call now — who calls back, how fast?"
- "After-hours and weekends — what catches those?"
- "Where does a lead land — CRM, notebook, text thread?"
- "On HubSpot, GoHighLevel, something else, or nothing?" *(infra check, not a pitch)*
- "Typical job value — and your bigger ones?"
- "Last time you found out *after the fact* that a good lead slipped?"

## 8. Objection responses (outcome-first)

| Objection | Response |
|---|---|
| "Just an AI receptionist?" | "Answering's the wedge — value is recovered revenue, a current CRM, and knowing what to do next. Step 1 of 6." |
| "Replace my CRM?" | "No — your CRM stays the record. We keep it *complete*, not half-filled." |
| "HubSpot / GoHighLevel?" | "HubSpot's the default; GHL supported. No lock-in to any phone or CRM vendor — by design." |
| "What happens after a call?" | "Lead qualified, CRM updated, context captured, next action in your queue." |
| "Real customer data in the demo?" | "No — clearly-labeled mock data only. No real customer/PII." |
| "Live or simulated?" | "Today, a guided walkthrough on mock data." *(don't overpromise format)* |
| "Advanced AI memory active now?" | "No — Phase 1 is structured event capture; the advanced retrieval is deliberately gated for later. I'd rather under-promise." |
| "What's it built on?" *(only if asked)* | "Modern comms + CRM sync + event capture behind provider abstraction — plumbing. The point is recovered revenue." |

## 9. Value framing

- Sell the **business outcome** (recovered revenue, fewer leaks, operational clarity) — never the AI feature.
- Show **revenue protected before architecture.**
- "**What happened, what matters, what to do next**" — the founder briefing, not another inbox.
- Business Memory = **captured context**, not "RAG/vectors/AI brain."
- Vendors (Telnyx/Vapi/HubSpot) are **invisible infrastructure** unless asked.

## 10. Primary CTA options

*(final wording is an open operator decision — pick one and stay consistent)*
- **Book a Revenue Recovery Demo**
- **Revenue Memory Diagnostic**
- **Audit My Missed Revenue**

## 11. Follow-up close

> "Based on [N missed calls] at [$X jobs], this is a real leak we can close. Next step is a **[CTA]**
> where we map exactly where revenue's slipping and what catching it is worth. Want me to book it?"

Always leave with a **booked time or a dated next step** + send the calendar link and one-pager.

## 12. Non-goals / do-not-say list

**Don't:** call it "an AI receptionist" as the product · say "AI magic / powered by AI" as the pitch ·
say "RAG / vectors / embeddings / AI brain" · lead with vendor names · promise a live/clickable demo
before the format is decided · imply advanced per-tenant knowledge is active (it's v0.4-gated) · pitch
a poor-fit (no phone demand, negligible job value, heavy compliance) — disqualify honestly.

---

## Open decisions (preserved)

Final CTA wording · anchor vertical (accessibility/mobility · home services · HVAC · multi-vertical) ·
demo format (recorded/clickable/hybrid) · pricing-on-first-call. **Architecture:** OpenAI-as-LLM-brain-
inside-Vapi, and Node.js voice gateway + Redis behind/alongside Vapi (ADR-0032) — both remain open.

*Documentation / sales-enablement only. Brand 2.0 (ADR-0021) + communications canon (ADR-0031–0034);
Business Memory Phase-1 event-ledger only (ADR-0034); open decisions preserved.*
