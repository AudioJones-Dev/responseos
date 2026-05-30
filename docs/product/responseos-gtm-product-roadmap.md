# ResponseOS — GTM, Product, Design, Voice & Pricing Roadmap (Master Spec)

> **Status:** Canonical planning spec (documentation-only). All product, GTM, brand, pricing, and
> voice decisions consolidate here as a single source of truth for the next build phases.
> **Owner:** AJ Digital LLC.
> **Authored by:** Audio Jones.
> **Scope:** Strategy + roadmap. **Nothing in this document is implemented.** No runtime UI,
> routes, logo/favicon assets, voice integrations, pricing logic, provider SDKs, or deployment
> changes are introduced by it. Future tasks implement individual pieces under explicit authorization.

**Restrained public authorship line** (for metadata / footer / about / canonical references only —
not the landing hero):

> ResponseOS is an AJ Digital product authored by Audio Jones.
>
> *Built by AJ Digital. Authored by Audio Jones.*

The public landing page leads with the **customer problem** (memory leakage, context loss, missed
follow-up, revenue leakage, operational intelligence, AI-ready business memory) — not internal authorship.

---

## Table of contents

0. [About this document](#0-about-this-document)
1. [Canonical brand & product hierarchy](#1-canonical-brand--product-hierarchy)
2. [Product thesis](#2-product-thesis)
3. [Business Memory System architecture](#3-business-memory-system-architecture)
4. [Recommended technical stack](#4-recommended-technical-stack)
5. [Cost stack inventory](#5-cost-stack-inventory)
6. [Pricing strategy](#6-pricing-strategy)
7. [Plan limits](#7-plan-limits)
8. [Overage & add-on pricing](#8-overage--add-on-pricing)
9. [Voice persona customization](#9-voice-persona-customization)
10. [Voice provider architecture](#10-voice-provider-architecture)
11. [Voice UX flow](#11-voice-ux-flow)
12. [Public voice messaging](#12-public-voice-messaging)
13. [Audio Jones Brand 2.0 design integration](#13-audio-jones-brand-20-design-integration)
14. [ResponseOS wordmark / logo system](#14-responseos-wordmark--logo-system)
15. [Future logo asset pipeline](#15-future-logo-asset-pipeline)
16. [Business Memory landing page direction](#16-business-memory-landing-page-direction)
17. [Landing page components](#17-landing-page-components)
18. [CTA treatment](#18-cta-treatment)
19. [Canonical landing page copy](#19-canonical-landing-page-copy)
20. [Website / domain mapping](#20-website--domain-mapping)
21. [Product roadmap](#21-product-roadmap)
22. [GTM readiness checklist](#22-gtm-readiness-checklist)
23. [Open decisions](#23-open-decisions)
24. [Relationship to existing canonical docs (conflicts & reconciliation)](#24-relationship-to-existing-canonical-docs-conflicts--reconciliation)
25. [Document status & TODOs](#25-document-status--todos)

---

## 0. About this document

This is the consolidated GTM/product/design/voice/pricing strategy for **ResponseOS**, an AJ Digital
founder app authored by Audio Jones. It exists to give one clear, reviewable source of truth before
any of the next build phases (brand finalization, landing page, pricing model, voice product, domain
mapping) begin.

It deliberately **does not** override the existing engineering canon. Where this GTM spec diverges
from the established `RESPONSEOS_*` canonical doc set or the ADRs in [`../DECISIONS.md`](../DECISIONS.md),
those divergences are **documented as open conflicts** in [§24](#24-relationship-to-existing-canonical-docs-conflicts--reconciliation)
for operator reconciliation — not silently resolved. Treat §24 as required reading before acting on §4 (stack) or §6–§8 (pricing).

---

## 1. Canonical brand & product hierarchy

```txt
AJ Digital LLC               = company / owner
Audio Jones                  = founder, author, operator, public brand persona
audiojones.com               = personal brand / authority / GTM website
ajdigital.app                = product / app infrastructure domain
ResponseOS                   = AJ Digital founder app / product system
Business Memory System       = offer / category language
Founder Intelligence Systems = broader strategic product family
```

**Public-facing usage rule.** Do not make internal authorship the hero message. Use the restrained
authorship phrases (above) for metadata, footer, about/product context, documentation, canonical
references, brand architecture, and website mapping. The landing page leads with the customer problem.

---

## 2. Product thesis

ResponseOS helps founder-led service businesses stop leaking revenue through lost context, missed
calls, scattered notes, weak follow-up, undocumented workflows, and fragmented business memory.

> **A business memory and response system for founder-led service businesses.**

The initial GTM wedge is the **Managed Business Memory System** (a.k.a. **Business Memory System**) —
an offer that turns scattered business context into structured, AI-ready operational memory.

---

## 3. Business Memory System architecture

Three layers:

| Layer | Purpose | Recommended tooling |
|---|---|---|
| **Raw Evidence** | Original source files and artifacts | Cloudflare R2 / S3-compatible object storage |
| **Structured Memory** | Database records, entities, events, outcomes, usage, relationships | Neon Postgres |
| **Narrative Memory** | Human-readable summaries, SOPs, decisions, context, doctrine, operating intelligence | Obsidian / Markdown-compatible vault |

Canonical rule:

```txt
Object storage          = system of evidence
Postgres                = system of record
Obsidian / Markdown     = system of meaning
AI agents               = reasoning and execution layer
```

### Client vault logic

Each client/subscriber gets a dedicated memory container:

```txt
AJ Digital Master Framework Vault
        ↓
Client-Specific Business Memory Vault
        ↓
Structured Records in Neon
        ↓
Raw Evidence in R2
        ↓
AI Retrieval / Summarization / Reporting
```

**Offer-framing rule.** Do not sell "an Obsidian install" as the core offer. Sell the managed
business outcome:

> Every client gets a dedicated Business Memory Vault. Local Obsidian installation is optional for
> teams that want direct hands-on access.

---

## 4. Recommended technical stack

> ⚠️ **Conflict note:** this stack diverges from the established go-forward stack in
> [`RESPONSEOS_BUILD_SOURCE.md`](./RESPONSEOS_BUILD_SOURCE.md) (notably voice-provider priority and
> CRM system-of-record). See [§24](#24-relationship-to-existing-canonical-docs-conflicts--reconciliation)
> before treating this as decided.

Default v1 stack:

```txt
Vercel + Clerk + Neon + Cloudflare R2 + Markdown Vault + OpenAI API + n8n
```

| Function | Recommended platform |
|---|---|
| App hosting | Vercel |
| Structured database | Neon Postgres |
| Raw file storage | Cloudflare R2 |
| Authentication | Clerk |
| Memory vault format | Markdown / Obsidian-compatible vault |
| AI reasoning | OpenAI API (default) |
| Optional AI reasoning | xAI/Grok, Anthropic, Gemini, OpenRouter |
| Voice / call routing | Twilio or Telnyx |
| AI voice agents | OpenAI Realtime, Vapi, Retell, or Bland (future validation) |
| Transcription | OpenAI Whisper or Deepgram |
| Premium / custom voice design | ElevenLabs |
| Automation | n8n first; Make/Zapier as client-specific alternatives |
| Monitoring | Sentry, PostHog, Langfuse, Helicone |

### Neon vs Supabase

Use **Neon Postgres** by default because Clerk handles auth, Cloudflare R2 handles storage,
ResponseOS needs clean structured memory, modular architecture is preferred, and database concerns
should stay separate from auth and object storage. Use **Supabase** only if a future direction
intentionally consolidates auth, storage, Postgres, realtime, and edge functions into one backend.

---

## 5. Cost stack inventory

> All vendor pricing is **TODO: verify** before any pricing commitment (see [§25](#25-document-status--todos)).

### App & infrastructure

| Platform | Role | Cost type | Include / pass through |
|---|---|---|---|
| Vercel | Frontend/app hosting | fixed + usage | include with cap |
| Neon | Postgres database | fixed + usage | include with cap |
| Cloudflare R2 | Raw file/object storage | usage | include with storage cap |
| Cloudflare Workers | ingestion/webhook/edge functions | usage | include with cap |
| Cloudflare DNS/CDN | DNS, caching, security | mostly fixed/low | include |
| Clerk | authentication/org management | fixed + MAU | include with user cap |
| GitHub | repo, CI/CD, issues | fixed/internal | internal cost |

### AI reasoning providers

| Provider | Use case | Cost risk | Include / pass through |
|---|---|---|---|
| OpenAI API | summarization, extraction, classification, agents, embeddings, voice | high | include with usage cap |
| xAI / Grok API | optional alternate reasoning/search-style analysis | medium/high | optional / pass-through |
| Anthropic API | high-quality reasoning / document analysis | high | optional / pass-through |
| Google Gemini API | long-context and multimodal reasoning | medium | optional / pass-through |
| Perplexity API | web-connected research | medium | optional / pass-through |
| OpenRouter | model routing | variable | internal / optional |
| Local models | low-cost / offline processing | hardware/time | internal |

### Voice, phone & transcription

| Platform | Use case | Cost type | Include / pass through |
|---|---|---|---|
| Twilio | numbers, SMS, voice routing | per number/minute/message | capped / pass-through |
| Telnyx | Twilio alternative | per number/minute/message | capped / pass-through |
| OpenAI Realtime | real-time AI voice conversation | token/minute | capped / pass-through |
| OpenAI Whisper | transcription | usage/minute | capped |
| Deepgram | transcription / speech intelligence | usage/minute | capped |
| Vapi | AI voice agent orchestration | per minute + provider cost | pass-through or capped |
| Retell | AI voice agent orchestration | per minute + provider cost | pass-through or capped |
| Bland | AI phone calls | per minute | pass-through or capped |
| ElevenLabs | premium voice design, TTS, voice cloning with consent | character/minute/subscription | Growth/Enterprise add-on |
| AssemblyAI | transcription + analysis | usage/minute/hour | optional |

### Document intelligence / extraction

| Platform | Use case | Cost type | Include / pass through |
|---|---|---|---|
| OpenAI Vision | screenshots, image/PDF understanding | token usage | capped |
| Google Document AI | OCR / document parsing | per page | optional / pass-through |
| AWS Textract | forms, receipts, OCR | per page | optional / pass-through |
| Unstructured.io | document ingestion/parsing | usage | optional |
| LlamaParse | PDF parsing for RAG | usage/page | optional |
| Firecrawl | site scraping/crawling | credits/pages | optional |
| Apify | scraping actors | platform + usage | optional / pass-through |

### CRM / email / calendar / workflow

| Platform | Use case | Cost treatment |
|---|---|---|
| HubSpot | CRM integration / source system | client-owned or pass-through |
| GoHighLevel | CRM / marketing automation | client-owned or pass-through |
| Airtable | lightweight ops database | client-owned |
| Notion | workspace / docs | client-owned |
| Google Workspace | email/docs/calendar | client-owned |
| Microsoft 365 | email/docs/calendar | client-owned |
| Zapier | automation glue | client-owned or pass-through |
| Make | automation scenarios | client-owned or pass-through |
| n8n | self-hosted automation | internal hosting + maintenance |
| Pipedream | workflow automation | usage / pass-through |

### Analytics / monitoring / usage control

| Platform | Use case | Cost treatment |
|---|---|---|
| DataForSEO | SEO/AEO question & keyword data | internal or project-based |
| Google Search Console API | site performance | free API, setup labor |
| Google Analytics API | analytics | free API, setup labor |
| Microsoft Clarity | behavior analytics | free/low |
| Hotjar | behavior analytics | client-owned or optional |
| PostHog | product analytics | include with cap |
| Sentry | error monitoring | internal |
| Better Stack / Logtail | logs / uptime | internal |
| Langfuse | LLM tracing / evals | internal, required long-term |
| Helicone | LLM usage / cost tracking | internal, required long-term |

---

## 6. Pricing strategy

Pricing is **not** storage-based. Price the offer as: *managed business memory, operational
intelligence, and AI-ready context infrastructure.*

```txt
Monthly Price =
  Platform Fee
  + Memory Capacity
  + Automation / AI Usage
  + Voice / Transcription Capacity
  + Support / Strategy Layer
```

Internal pricing rule:

```txt
Minimum price   = 3x to 5x expected monthly hard cost
Actual price    = value-based retainer
Usage overages  = pass-through + margin
```

### Recommended public plans

| Plan | Best for | Suggested price |
|---|---|---:|
| Starter Memory System | solo founder / tiny business | $497–$750/mo |
| Operator System | service business with calls/docs/follow-up | $1,250–$2,000/mo |
| Growth Intelligence System | active ops, CRM, automations, reporting | $2,500–$5,000/mo |
| Enterprise | high-volume calls, files, teams, governance | custom / $5,000+/mo |

> ⚠️ All price points are **TODO: verify** against a built cost model before publishing (see [§24](#24-relationship-to-existing-canonical-docs-conflicts--reconciliation) for existing pricing-doc divergence and [§25](#25-document-status--todos)).

---

## 7. Plan limits

### Starter Memory System — $497–$750/mo

- 1 managed Business Memory Vault
- 5 GB raw evidence storage
- 1,000 structured records/events
- 250 AI memory actions/month
- 0–100 voice/transcription minutes/month
- 1 default voice persona
- English-only by default unless configured
- monthly memory summary
- basic SOP / research organization
- 1 connected source/system

**Best for:** solo founder, early-stage consultant, small operator, low file/call volume.

### Operator System — $1,250–$2,000/mo *(featured / default tier)*

- 1 managed Business Memory Vault
- 25 GB raw evidence storage
- 10,000 structured records/events
- 1,000 AI memory actions/month
- 300 voice/transcription minutes/month
- preset voice personas
- English / Spanish / Haitian Creole options
- Multilingual Miami Assistant available
- basic script customization
- standard handoff policy
- CRM / call / email context capture
- weekly memory updates
- monthly revenue leak report
- up to 3 connected systems

**Best for:** service business, contractor/operator, agency, local business with phone/email/client ops.

### Growth Intelligence System — $2,500–$5,000/mo

- 1 advanced Business Memory Vault
- 100 GB raw evidence storage
- 50,000 structured records/events
- 5,000 AI memory actions/month
- 1,000 voice/transcription minutes/month
- tuned voice persona
- multilingual routing
- custom business vocabulary
- advanced scripts
- call outcome reporting
- automations
- dashboards
- SOP creation
- weekly intelligence reports
- up to 6 connected systems
- priority strategy support
- optional ElevenLabs / custom voice add-on

**Best for:** high-volume founder-led company, multi-staff operation, active sales/service workflow,
operational complexity.

### Enterprise — custom / $5,000+/mo

- custom storage
- custom retention policy
- team access / governance
- dedicated integrations
- high-volume voice/transcription
- custom branded voice options
- multilingual routing
- compliance review
- custom reporting
- implementation roadmap
- custom SLA
- provider pass-through terms where required

---

## 8. Overage & add-on pricing

Overages protect margin.

| Overage / add-on | Suggested charge |
|---|---:|
| Extra raw storage | $10–$25 per additional 25 GB/month |
| Extra structured records | $25–$100 per additional 10,000 records |
| Extra AI memory actions | $25–$75 per 1,000 actions |
| Extra voice/transcription minutes | $25–$100 per 500 minutes |
| Extra connected system | $100–$250/mo |
| Extra automation workflow | $250–$1,000 setup + usage |
| Extra custom report | $250–$1,500/report |
| Extra voice persona | $250–$1,000 setup |
| Custom multilingual script | $500–$2,500 setup |
| Custom Voice Persona setup | $500–$2,500 one-time |
| Custom branded voice | pass-through + markup |
| Compliance / approval script review | $500–$2,500 setup |
| Extra phone number | pass-through + margin |
| Extra call flow | $500–$2,500 setup |
| Local Obsidian install + training | $500–$2,500 one-time |
| Data migration / import | $500–$5,000 one-time |

**Critical product rule:**

```txt
Do not advertise unlimited voice usage.
```

Every voice-enabled plan must have: **included allowance + overage + optional custom setup.**

---

## 9. Voice persona customization

Frame voice customization as **business persona configuration**, not novelty. Separate:

```txt
Voice Sound      = how the agent sounds
Agent Behavior   = what the agent does
Business Policy  = what the agent is allowed to say/do
```

**Product setting name:** `Voice Persona Configuration` (not `Male/Female Voice Picker`). Gendered
voice labels may exist internally or via provider metadata, but customer-facing UX leads with
business persona, tone, language, and role.

### Configurable fields

voice persona name · agent role · language mode · accent/dialect · tone · vibe · pace · formality ·
provider voice ID · reasoning provider · voice provider · telephony provider · escalation policy ·
script template · approved phrases · disallowed phrases · fallback behavior · business vocabulary ·
compliance constraints (where applicable).

### Language modes

English · Spanish · Haitian Creole · English+Spanish · English+Haitian Creole · Spanish+Haitian Creole ·
Multilingual (English+Spanish+Haitian Creole). Prefer **Multilingual** over **Bilingual** where appropriate.

### Recommended launch personas

1. Warm Professional
2. Direct Dispatcher
3. Multilingual Miami Assistant
4. Premium Concierge
5. Lead Qualification Specialist

### Multilingual Miami Assistant (strategic South Florida persona)

Launch language direction: English · Spanish · Haitian Creole · multilingual routing/fallback.

> Answer professionally in English, Spanish, and Haitian Creole without hiring a full-time
> multilingual receptionist.

**Use cases:** contractors, home services, medical-adjacent intake, transportation, hospitality,
real estate, legal intake (with proper disclaimers), local service businesses across Miami-Dade,
Broward, and Palm Beach.

---

## 10. Voice provider architecture

Voice customization is split across layers, not one provider.

| Layer | Best fit | Role |
|---|---|---|
| ResponseOS | product configuration | stores persona settings, business rules, scripts, language mode, escalation policy |
| OpenAI | reasoning + basic voice + transcription | agent brain, voice conversation, tool calls, summaries, translation/transcription |
| ElevenLabs | custom/premium voice design | branded voice, cloned voice (with consent), polished TTS, voice library |
| Grok / xAI | optional reasoning/search layer | not the default voice-design layer |
| Vapi / Retell / Bland | voice-agent orchestration | phone agent infra, call handling, provider routing |
| Twilio / Telnyx | telephony | phone numbers, SIP, call routing, SMS |

### Recommended launch provider strategy

Default v1:

```txt
OpenAI          = reasoning, basic voice, transcription, summaries
Twilio/Telnyx   = phone numbers and call routing
ResponseOS      = persona config, business rules, memory logging
```

Premium/custom:

```txt
ElevenLabs      = custom branded voice / voice design / voice cloning with consent
Vapi or Retell  = optional voice-agent orchestration if it reduces build complexity
```

> ⚠️ **Conflict note:** existing canon (`RESPONSEOS_BUILD_SOURCE.md` / integration map) names a
> different default voice path. See [§24](#24-relationship-to-existing-canonical-docs-conflicts--reconciliation).

### Conceptual voice persona schema (do **not** implement)

```ts
type VoicePersona = {
  id: string
  name: string
  description: string
  role: "receptionist" | "dispatcher" | "sales" | "concierge" | "operations"
  languageMode:
    | "english"
    | "spanish"
    | "haitian_creole"
    | "english_spanish"
    | "english_haitian_creole"
    | "spanish_haitian_creole"
    | "multilingual_english_spanish_haitian_creole"
  tone: "warm" | "neutral" | "direct" | "energetic" | "calm"
  formality: "casual" | "standard" | "polished"
  pace: "slow" | "normal" | "fast"
  reasoningProvider: "openai" | "anthropic" | "grok" | "gemini" | "other"
  voiceProvider: "openai" | "elevenlabs" | "vapi" | "retell" | "other"
  telephonyProvider: "twilio" | "telnyx" | "other"
  voiceId: string
  escalationPolicyId: string
  scriptTemplateId: string
}
```

*Conceptual schema only — included for shared understanding, not for implementation.*

---

## 11. Voice UX flow

**Step 1 — Choose agent job.** *"What should this agent do?"* → answer missed calls · qualify leads ·
book appointments · route calls · collect job details · follow up with prospects · confirm service requests.

**Step 2 — Choose voice persona.** *"How should the agent sound and behave?"* → Warm Professional ·
Direct Dispatcher · Multilingual Miami Assistant · Premium Concierge · Lead Qualification Specialist.

**Step 3 — Fine tune.** Language (English / Spanish / Haitian Creole / Multilingual) · tone
(warm / neutral / direct / energetic / calm) · pace (slow / normal / fast) · formality
(casual / standard / polished) · handoff (conservative / standard / aggressive human handoff).

---

## 12. Public voice messaging

Customer-facing language:

> Includes a configured AI phone persona with monthly call/transcription capacity. Plans scale based
> on call volume, language support, customization depth, and reporting needs.

Avoid leading public copy with provider names (OpenAI, ElevenLabs, Twilio, Vapi, Retell, Grok).
Provider names may appear in technical docs, not primary landing-page copy.

---

## 13. Audio Jones Brand 2.0 design integration

Canonical brand source (operator-provided Canva brand kit):

```txt
https://www.canva.com/brand/kAHJkU6n4S8     (Brand Kit ID: kAHJkU6n4S8)
```

A separate kit named `Audio Jones` (ID `kAFqjeSOv-U`) is **secondary / legacy** unless the operator
confirms otherwise. Relevant external Canva references (source only, not repo assets):
`AUDIO JONES LOGO 2.0` · `AUDIO JONES LOGO V2` · `audio jones new brand pallet` ·
`AUDIO JONES COVER 2026 (Website Hero)` · `AUDIO JONES LOGOS 2026`.

**Constraints:** do not call Canva from repo code · do not hardcode Canva asset URLs into production
code · do not add Canva images unless explicitly exported/provided · add TODOs for final verified
palette/assets if exact values are not in repo files.

### Working palette

> ⚠️ **TODO: verify** exact values against Canva kit `kAHJkU6n4S8`. Use as working palette unless repo
> tokens define a newer source of truth. (Note: `app/globals.css` currently implements the v0.2
> `DESIGN.md` token set, which is a *different* dark-first palette — see [§24](#24-relationship-to-existing-canonical-docs-conflicts--reconciliation).)

**Canvas / surfaces**

```txt
canvas:            #000000
canvas-soft:       #080808
surface-card:      #0A0A0C
surface-elevated:  #101012
surface-deep:      #06060A
```

**Text**

```txt
ink:   #FCFDFF
white: #FFFFFF
body:  rgba(252,253,255,0.86)
gray:  #D3D3D3
mute:  #A1A4A5
ash:   #888E90
```

**Brand / signal**

```txt
signal-yellow:  #E8FF5A
brand-gold:     #FFD700
system-teal:    #008080
action-orange:  #FF4500
```

**Borders**

```txt
hairline:         rgba(255,255,255,0.06)
hairline-strong:  rgba(255,255,255,0.14)
```

**Glows**

```txt
signal-yellow-glow:  rgba(232,255,90,0.18)
brand-gold-glow:     rgba(255,215,0,0.16)
system-teal-glow:    rgba(0,128,128,0.20)
action-orange-glow:  rgba(255,69,0,0.18)
```

### Semantic color rules

| Token | Meaning | Use |
|---|---|---|
| `signal-yellow` | intelligence, clarity, primary brand signal | primary CTA, key metrics, intelligence highlights |
| `brand-gold` | legacy Audio Jones warmth / credibility | subtle badges, heritage accents |
| `system-teal` | memory, systems, structure | diagrams, data flows, memory architecture |
| `action-orange` | urgency, revenue leak, action | warnings, diagnostic urgency, leak moments |
| `ink` / `white` | premium readability | headlines, body, UI text |
| `canvas` / `canvas-soft` | premium editorial base | page background and deep sections |

Design rule: **signal emerging from black.** Do not turn the system into a generic colorful SaaS gradient.

---

## 14. ResponseOS wordmark / logo system

The site uses **Syne**. ResponseOS uses a typographic wordmark based on Syne.

### Primary wordmark — `ResponseOS`

- Typeface: Syne · weights: Syne Bold or Syne ExtraBold
- Case: exactly `ResponseOS`
- Default color on dark surfaces: `#FCFDFF` or `#FFFFFF`
- Optional accent: `OS` or an underline/glow may use Signal Yellow `#E8FF5A`
- Prefer one-color wordmark first; avoid over-styling

### Secondary compact mark — `RO`

Use for favicon exploration, app icon exploration, compact sidebar mark, loading state, social avatar.
Typeface: Syne Bold/ExtraBold. `RO` is a utility mark, **not** the primary website mark — use the full
wordmark wherever it fits.

### Logo treatment rules

**Do:** use Syne · keep the wordmark clean, modern, premium, technical · full `ResponseOS` in
navbar/header · `RO` only where space is constrained · keep compatible with black canvas · prepare
future SVG/vector/favicon export requirements.

**Do not:** introduce another logo font · use gradients/bevels/3D/chrome/glossy styling · distort
letterforms · use generic AI icons as the main logo · make the icon more important than the wordmark.

---

## 15. Future logo asset pipeline

```txt
1. Generate ResponseOS logo concepts as images
2. Select strongest direction
3. Convert selected direction into clean vector/SVG
4. Create wordmark variants
5. Create compact RO mark
6. Export favicons/app icons
7. Add final assets to repo
8. Map usage in navbar, metadata, Open Graph, app icon, favicon
```

**Future required logo assets** (do **not** create yet unless assets already exist or are operator-provided):

```txt
/public/brand/responseos-wordmark.svg
/public/brand/responseos-wordmark-dark.svg
/public/brand/responseos-wordmark-light.svg
/public/brand/responseos-mark.svg
/public/brand/responseos-mark-dark.svg
/public/brand/responseos-mark-light.svg
/public/favicon.ico
/public/favicon.svg
/public/apple-touch-icon.png
/public/icon-192.png
/public/icon-512.png
/public/og/responseos-og.png
```

---

## 16. Business Memory landing page direction

**Mood:** premium · diagnostic · intelligent · founder-facing · technical but readable · editorial
SaaS · calm but urgent · signal-driven · operationally credible.

**Visual motifs:** memory layers · raw evidence trails · operational timelines · node maps ·
call/email/doc ingestion flows · structured intelligence cards · revenue leak diagnostics ·
vault/archive/source-of-truth metaphors · system-of-record → system-of-meaning transformation.

**Avoid:** generic robot imagery · generic AI brain graphics · neon cyberpunk overload · colorful
dashboard clutter · stock-photo SaaS teams · excessive gradients.

---

## 17. Landing page components

### `memory-layer-diagram`
Shows the three-layer memory model (Raw Evidence → Structured Memory → Narrative Memory). Black canvas,
dark cards, hairline borders, teal connector lines, yellow highlight on "AI-ready context," orange only
for leak/loss warnings.

### `revenue-leak-card`
Symptoms of context/memory loss: missed follow-ups · repeated explanations · scattered client context ·
undocumented SOPs · lost job details · messy CRM data · forgotten decisions · no source of truth for AI
assistants. Dark card, subtle orange micro-accent, no heavy red/error styling, concise editorial copy.

### `business-memory-vault-card`
What the client receives: managed vault · structured records · raw evidence storage · AI-ready SOPs ·
searchable context · revenue leak reports · workflow documentation · optional local Obsidian install ·
monthly/weekly intelligence updates. Dark surface, yellow signal dot/top border, teal metadata chips,
restrained copy.

### `pricing-capacity-card`
Tiers (Starter / Operator / Growth / Enterprise) showing included storage, structured records/events,
AI memory actions, voice/transcription minutes, connected systems, reporting cadence, support depth.
Operator System is the featured/default tier. Capacity/value drives layout, not seat-only pricing.

### `voice-persona-card`
Persona options (Warm Professional · Direct Dispatcher · Multilingual Miami Assistant · Premium
Concierge · Lead Qualification Specialist) showing language support, tone, pace, handoff strictness,
best-fit business type. Business role first, sound/style second — no gimmicky gender-first UI.

---

## 18. CTA treatment

- **Primary CTA:** `Book a Revenue Memory Diagnostic` — Signal Yellow `#E8FF5A` button, black `#000000`
  text, optional sparing yellow glow behind the hero CTA.
- **Secondary CTA:** `See How the System Works` — dark ghost button with hairline border.

Do not use too many CTA styles.

---

## 19. Canonical landing page copy

**Hero**

> **Your business is leaking memory, context, and follow-up.**
>
> AJ Digital builds managed Business Memory Systems for founder-led service businesses — capturing
> calls, notes, docs, decisions, SOPs, and workflows into one structured intelligence layer your team
> and AI assistants can actually use.
>
> Primary CTA: **Book a Revenue Memory Diagnostic** · Secondary CTA: **See How the System Works**

**Problem section**

> **The problem is not that your business lacks tools. It lacks memory.**
>
> missed follow-ups · repeated explanations · scattered client context · undocumented SOPs · lost job
> details · messy CRM data · decisions trapped in conversations · no source of truth for AI assistants

**System section**

> **We turn scattered business activity into structured memory.**

**Voice section**

> **Give your business a response voice that matches how you operate.**
>
> Configure a voice persona by role, language, tone, pace, and handoff behavior — from a direct
> dispatcher to a multilingual Miami assistant.

**Pricing section**

> **Plans scale with memory capacity, automation volume, voice usage, and reporting depth.**

**Final CTA**

> **Start with a diagnostic.**
>
> We identify where your business is losing memory, context, and follow-up — then map the system
> needed to capture it.
>
> CTA: **Book a Revenue Memory Diagnostic**

---

## 20. Website / domain mapping

Operator owns `audiojones.com` and `ajdigital.app`.

```txt
audiojones.com = public personal brand, authority, content, solution navigation, GTM pages
ajdigital.app  = product/app infrastructure, authenticated tools, portals, dashboards, client systems
```

**Recommended first GTM mapping**

```txt
audiojones.com/responseos              = first public ResponseOS landing page
audiojones.com/business-memory-system  = offer / SEO / AEO page for the Business Memory System
app.ajdigital.app                      = future authenticated app / client portal
ajdigital.app                          = product gateway or redirect to app.ajdigital.app once ready
```

**Future optional subdomains**

```txt
responseos.audiojones.com  = dedicated ResponseOS marketing subdomain if needed
responseos.ajdigital.app   = product/app environment for ResponseOS
clients.ajdigital.app      = client portal
vault.ajdigital.app        = future business memory vault interface
status.ajdigital.app       = future status page
docs.ajdigital.app         = future product docs
```

**Strategic rule.** Use `audiojones.com` to sell trust, authority, diagnostics, and solutions. Use
`ajdigital.app` to deliver software, dashboards, memory systems, reports, and client portals. Do not
make `ajdigital.app` the primary public marketing site unless the brand strategy shifts from
personal-brand-led to product-company-led.

---

## 21. Product roadmap

### Phase 0 — Documentation / canonical alignment *(current phase)*
Create source-of-truth docs for product, pricing, brand, voice, and GTM mapping; cross-link from the
docs index; identify conflicts with existing docs; document next decisions; no runtime changes.

### Phase 1 — Brand & GTM design foundation
Confirm Audio Jones Brand 2.0 palette from Canva · finalize ResponseOS wordmark direction · generate
logo concepts · select direction · vectorize final wordmark/mark · export favicons/app icons · update
design docs · define OG image direction. *No app implementation unless explicitly authorized.*

### Phase 2 — Landing page strategy & copy
Finalize `audiojones.com/responseos` outline · finalize Business Memory System offer page logic ·
finalize hero/sections/CTAs/pricing messaging · finalize voice persona section · finalize diagnostic
CTA destination · decide whether pricing is public, range-based, or private.

### Phase 3 — Pricing & cost model
Create cost matrix · verify vendor costs · define included limits · define overage rates · define
setup fees · define pass-through provider policy · define margin targets by plan · define voice usage
caps · define ElevenLabs/custom voice add-on policy.

### Phase 4 — Voice persona product definition
Define preset personas · define multilingual language modes · define provider strategy · define
escalation policies · define script template structure · define approved/disallowed phrase model ·
define handoff logic · define call outcome logging · define voice pricing impact · decide OpenAI vs
Vapi/Retell orchestration path. *No voice provider implementation yet.*

### Phase 5 — Website / domain implementation
Implement the first public GTM route (recommended `audiojones.com/responseos`; secondary
`audiojones.com/business-memory-system`): create route/page · implement landing using the approved
design system · add metadata · add OG image · add CTA · connect diagnostic/booking destination ·
avoid premature app-domain deployment.

### Phase 6 — App layer / portal mapping
Decide root behavior for `ajdigital.app` · decide `app.ajdigital.app` login flow · decide future
`clients.ajdigital.app` and `vault.ajdigital.app` · define authenticated app shell · define client
portal boundaries · map ResponseOS app routes · define deployment readiness checklist.

### Phase 7 — Voice / telephony pilot
Choose telephony provider · choose orchestration provider if any · implement one preset persona first ·
implement call transcription · implement call outcome logging · test English/Spanish/Haitian Creole
handling · monitor cost per call · monitor failure/handoff rates · refine pricing from usage.

---

## 22. GTM readiness checklist

**Brand** — [ ] confirm final Brand 2.0 palette · [ ] confirm ResponseOS Syne wordmark ·
[ ] generate logo concepts · [ ] select final logo · [ ] create vector/SVG assets ·
[ ] create favicon/app icons · [ ] create OG image

**Product** — [ ] confirm final offer name · [ ] confirm plan names · [ ] confirm included capacity ·
[ ] confirm overage policy · [ ] confirm voice persona presets · [ ] confirm multilingual scope ·
[ ] confirm voice provider strategy · [ ] confirm app/domain boundaries

**Website** — [ ] decide first GTM route · [ ] build landing page · [ ] add diagnostic CTA ·
[ ] add metadata · [ ] add analytics · [ ] add tracking · [ ] add conversion event ·
[ ] add follow-up workflow

**Pricing** — [ ] verify vendor pricing · [ ] build cost model · [ ] define hard cost cap per tier ·
[ ] define gross margin target · [ ] define setup fees · [ ] define pass-through policy ·
[ ] define voice usage overage

**Deployment** — [ ] confirm no secrets in repo · [ ] confirm Vercel project mapping ·
[ ] confirm env var strategy · [ ] confirm domain/subdomain plan · [ ] confirm preview deploy
behavior · [ ] confirm production deploy checklist

---

## 23. Open decisions

**Brand / design** — exact Canva palette from `kAHJkU6n4S8` · Signal Yellow `#E8FF5A` vs Gold
`#FFD700` as primary CTA color · final ResponseOS wordmark treatment · whether `OS` gets accent color ·
logo concept direction · favicon mark direction (`RO`, symbol, or wordmark crop).

**Product / offer** — final public offer name · whether ResponseOS and Business Memory System are
separate pages or one funnel · whether voice AI is a launch offer or future add-on · whether
Obsidian/local vault access is Growth/Enterprise-only · whether client owns their storage/database in
Enterprise.

**Pricing** — final monthly price points · setup fee amount · voice/transcription minute caps · AI
action caps · storage caps · overage rates · minimum contract length · cancellation/data-export policy.

**Voice** — OpenAI as default voice/reasoning provider · ElevenLabs as premium custom/branded voice ·
whether Vapi/Retell is needed for v1 · Twilio vs Telnyx · Haitian Creole support quality before
promising broadly · compliance review requirements for regulated niches.

**Website / domain** — first GTM route (`audiojones.com/responseos` vs
`audiojones.com/business-memory-system` vs `responseos.audiojones.com`) · role of `ajdigital.app` ·
whether `app.ajdigital.app` should exist before public launch · whether `ajdigital.app` root redirects
to login, waitlist, or product gateway.

---

## 24. Relationship to existing canonical docs (conflicts & reconciliation)

> _From a direct audit of the existing `RESPONSEOS_*` canon and ADRs ([`../DECISIONS.md`](../DECISIONS.md)).
> Each conflict is an **open decision for the operator** — this GTM spec is a prose doc and, under
> ADR-0011's reconciliation rule, **does not supersede an ADR**. Resolving a conflict in favor of this
> GTM direction requires a new/updated ADR; otherwise the existing ADR stands._

### Conflicts to reconcile

| # | Topic | This GTM spec says | Existing canon says | Severity |
|---|---|---|---|---|
| 1 | **Product category / positioning** | "Business memory and response system"; wedge = **Managed Business Memory System** | "**ResponseOS is the AI Revenue Recovery Platform**" ([`PRD.md`](../PRD.md), [`product-spec.md`](../product-spec.md)) | **High** |
| 2 | **Plan names & pricing model** | Starter / Operator / Growth Intelligence / Enterprise **Memory System**; memory-capacity retainers | Recovery Core / Recovery Pro / Recovery Performance + outcome fees; billing engine ships **v0.5** ([`pricing-and-onboarding.md`](../pricing-and-onboarding.md), ADR-0010) | **High** |
| 3 | **Structured database** | **Neon Postgres** by default | **Postgres on Supabase** (Standard lane), Prisma ORM (ADR-0003) | **High** |
| 4 | **Primary realtime voice** | **OpenAI** default; Grok optional alternate | **Grok Voice primary, OpenAI Realtime fallback** (ADR-0012, supersedes ADR-0008) | **High** |
| 5 | **Brand palette & type** | Brand 2.0: black canvas, **signal-yellow `#E8FF5A` as the *primary* signal**; `#FF4500` *retained* as a **secondary** `action-orange`; gold/teal accents; **Syne** wordmark | [`DESIGN.md`](../DESIGN.md) dark-first with **`#FF4500` as the *primary* accent**, **Sora/Inter/JetBrains Mono** — already implemented in `app/globals.css` (v0.2 UI, PR #43) | **High** |
| 6 | **Per-client memory vault** | Each client gets a dedicated **Business Memory Vault** (per-tenant narrative memory) | Obsidian is the **operator-side** SOP/brand layer, **explicitly not per-tenant RAG/grounding** (ADR-0016); per-tenant knowledge layer is **v0.4-gated** ([`ROADMAP.md`](../ROADMAP.md)) | **High** |
| 7 | **CRM system of record** | CRM = client-owned source systems, pass-through; no named default | **HubSpot is the default external CRM system of record** (ADR-0015); event ledger is the internal SoR (ADR-0002) | Medium |
| 8 | **Realtime architecture** | Stack lists OpenAI/Vapi/Retell + Twilio/Telnyx; no separate gateway or cache | Dedicated **Node.js voice gateway** (ADR-0013) + **Redis** ephemeral session state (ADR-0014) — omitted here | Medium |
| 9 | **Telephony** | Twilio **or Telnyx** | **Twilio** named (ADR-0012); Telnyx not yet a sanctioned alternative | Low |

### Overlaps (already in agreement — no conflict)

- **Clerk** for auth (ADR-0005), **Cloudflare R2** object storage (ADR-0006), **n8n** async automation kept out of the realtime loop (ADR-0017), **Postgres event ledger** as internal system of record (ADR-0002), observability via **PostHog + Sentry + Better Stack** (ADR-0018), and **mock-first / no live providers / v0.3 deploy gate** (ADR-0001, ADR-0019) all match this spec.
- Markdown/Obsidian as a **narrative layer** is shared in principle (ADR-0016) — the *scope* (operator-side vs per-client) is the conflict in row 6, not the tool.

### How to reconcile

1. **Positioning (row 1) and pricing (row 2)** are the load-bearing strategic decisions. If the operator
   adopts the Business-Memory framing, it should be ratified with a new ADR and reflected in
   [`PRD.md`](../PRD.md) / [`pricing-and-onboarding.md`](../pricing-and-onboarding.md); the two framings
   may also coexist (revenue-recovery as the *outcome*, business-memory as the *mechanism*).
2. **Stack/provider rows (3, 4, 7, 8, 9)** each need a superseding ADR if this GTM direction wins;
   until then ADR-0003/0012/0013/0014/0015 stand. Most are reversible (provider abstractions already exist).
3. **Brand (row 5) is directly relevant to reviewing PR #43.** That PR implements the `DESIGN.md`
   token system (orange `#FF4500` *primary* accent, Sora/Inter). The Brand 2.0 conflict is narrow but
   real: it shifts the **primary** signal color (orange → signal-yellow `#E8FF5A`) and the **wordmark
   type** (Sora → Syne), while `#FF4500` survives as a *secondary* action-orange — so #43 is not
   "wrong," it's pre-Brand-2.0. If Brand 2.0 is adopted, #43 can still merge, with a Brand-2.0 re-skin
   (token + font swap) following in Phase 1; alternatively, update `DESIGN.md` and the tokens first.
   **This is the explicit reason this GTM context was documented before merging #43.**
4. **Per-client vault (row 6)** must respect the v0.4 knowledge-layer gates in [`ROADMAP.md`](../ROADMAP.md)
   (tenant isolation, audit logging, retention, PII minimization) before any per-tenant ingestion ships.

---

## 25. Document status & TODOs

- **TODO (vendor pricing):** every price point in §6–§8 and every cost-stack rate in §5 is a working
  estimate. Build and verify the cost model (Phase 3) before publishing any number.
- **TODO (brand palette):** §13 values are the working palette pending verification against Canva kit
  `kAHJkU6n4S8`. The repo's live `app/globals.css` currently implements the v0.2 `DESIGN.md` token set
  (a different dark-first palette with `#FF4500` accent); reconcile in Phase 1 — see §24.
- **TODO (logo assets):** none of the §15 asset files exist yet; do not create them until the logo
  direction is selected and assets are produced/provided.
- **TODO (Haitian Creole voice quality):** validate provider quality before promising broadly (§23 voice).
- **File-safety confirmation:** this document changed no runtime code, routes, components, assets,
  fonts, dependencies, secrets, env vars, or deployment configuration. It is documentation only.

---

*ResponseOS — a business memory and response system for founder-led service businesses.*
*An AJ Digital product authored by Audio Jones.*
