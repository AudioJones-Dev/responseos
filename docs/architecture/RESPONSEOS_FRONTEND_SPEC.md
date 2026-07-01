# ResponseOS — Frontend Spec

**Owner:** AJ Digital LLC / Audio Jones
**Status:** Canonical (go-forward). Implements the visual system in [`../DESIGN.md`](../DESIGN.md) — tokens, components, UX writing rules, and non-negotiables there are inherited and must not be relitigated here.
**Read first:** [`../DESIGN.md`](../DESIGN.md) · [`RESPONSEOS_SYSTEM_ARCHITECTURE.md`](./RESPONSEOS_SYSTEM_ARCHITECTURE.md) · [`../brand/RESPONSEOS_BRAND_VOICE.md`](../brand/RESPONSEOS_BRAND_VOICE.md)

> Three surfaces on one Next.js App Router codebase: **Operator Console** (`app/(admin)`), **Client Portal** (`app/(client)`), **Marketing** (`app/(marketing)`). This spec defines what each surface does for the go-forward stack (voice sessions, provider failover visibility, tenant provisioning, integrations) and how white-label slots in. Visual tokens, component contracts, responsive rules, and accessibility live in `../DESIGN.md`.

---

## 1. Design system direction (inherited)

From `../DESIGN.md`: dark-first, high-contrast, low-noise; Syne (display) / DM Sans (UI) / DM Mono (IDs/timestamps); Signal Yellow `#E8FF5A` reserved for primary CTAs + recovered-revenue highlights; critical red / warning amber reserved for urgency; 12-col desktop grid, 240px sidebar, cards on `--color-surface`. Components: `MetricCard`, `RevenueMetricCard`, `StatusBadge`, `ProviderBadge`, `DataTable`, `DetailPanel`, `Timeline`, `EmptyState`, `AlertBanner`, `ActionButton`, etc. **Information hierarchy** (every screen): recovered revenue → qualified leads → bookings → missed calls recovered → response time → ROI → open opportunities → urgent escalations.

> Go-forward note: `ProviderBadge` variants must include **Grok**, **OpenAI** (and retain Twilio, Google Calendar) since these are the primary realtime voice providers (ADR-0012); Retell/Vapi/Bland become optional variants.

---

## 2. Operator Console (`app/(admin)`) — AJ Digital staff

Existing routes: `/admin`, `/admin/clients`, `/admin/calls`, `/admin/leads`, `/admin/bookings*`, `/admin/quotes`, `/admin/automations`, `/admin/playbooks`, `/admin/reports`, `/admin/workspaces`, `/admin/billing`, `/admin/settings`. Go-forward responsibilities:

| Area | Purpose | Go-forward additions |
|---|---|---|
| Overview | Portfolio health; clients needing attention; activity feed | Realtime: live-call count, provider-failover alerts |
| Clients/Tenants | Tenant list + health; provision/offboard | **Tenant provisioning wizard** (data-only); profile version management |
| Calls | All call events cross-tenant | **Voice session detail**: provider used, failover events, turn timeline |
| Leads | Qualification review, routing | unchanged |
| Transcripts/QA | Review + score calls | **Transcript review UI** (redacted default; raw via break-glass); `qa_logs` capture |
| Provider Status | Integration health | **Grok/OpenAI/Twilio/HubSpot/calendar** status + failover-rate panel |
| Reports | Cross-client ROI | report generation trigger |
| Settings | Users, roles, profiles | prompt/policy/routing/workflow **profile editors** (versioned, reason-required) |

### Tenant provisioning wizard (operator)
Steps map to the onboarding inputs (§4). Produces tenant + profiles + integration connection prompts — **no code change**. Each profile save creates a new version (immutable history, audit reason).

---

## 3. Client Portal (`app/(client)`) — tenant `client_admin` / `client_viewer`

Existing routes: `/client/dashboard`, `/client/calls`, `/client/leads`, `/client/bookings`, `/client/quotes`, `/client/revenue`, `/client/reports`, `/client/settings`. Per `../DESIGN.md` § 7: simpler than admin, business-language only, outcome-focused.

| Page | Must answer | Notes |
|---|---|---|
| Dashboard | "How much did we recover this month? ROI? Anything needs me?" | Hero: Recovered Revenue; supporting row: leads/bookings/response time/ROI |
| Calls | "What happened on our calls?" | Outcome labels in business language; recording/transcript per lane |
| Leads | "What leads came in and where are they?" | StatusBadge: Recovered/Booked/Needs Review/Archived |
| Appointments | "What's on the calendar from recovered leads?" | revenue attribution |
| Quotes | "What quotes are out and their status?" | |
| Revenue | "Show me the recovered-revenue trend + attribution" | line/bar charts per `../DESIGN.md` § 10 |
| Reports | "Monthly proof artifact" | PDF export + period summaries |
| Settings | Connect HubSpot/calendar; notification prefs; (future) branding | **Integrations connect UI** (§5) |

**Client-facing rules (non-negotiable, from `../DESIGN.md` § 17):** no technical jargon ("webhook", "Grok", "failover" never shown to clients); revenue prominent; every page has a clear next action; never `$0`/`null` without explanation.

---

## 4. Onboarding UX

Onboarding doubles as the Readiness Assessment data capture (commercial Phase 1) and tenant configuration. Flow (one step at a time, progress indicator, save-and-resume — per `../DESIGN.md` § 12):

1. Business profile (name, industry, service type)
2. Service areas (zips/cities/radius + exclusions)
3. Phone system (number, forwarding capability) → Twilio number assignment
4. CRM & calendar (connect HubSpot + Google/Cal.com via OAuth)
5. Average job value
6. Missed-call estimate
7. Appointment process + durations/blocked slots
8. Quote process (on-call vs after-visit)
9. Escalation contacts + transfer numbers + disclosure language by state
10. Brand voice / red-flag questions → seeds the prompt profile
11. AI Readiness Score (computed) → Recommended path/tier

Output: a provisioned (or assessed-only) tenant + a Readiness packet (Score, Leak Estimate, Fit/No-Fit, workflow maps, scope, projected ROI, Pricing Proposal).

---

## 5. Integrations connect UI (tenant `client_admin`)

- Cards per provider (HubSpot, Google Calendar / Cal.com, and future BYO Twilio/LLM) with status dot: connected / disconnected / error / expired.
- HubSpot/Google use OAuth (begin → callback → encrypted tokens stored in `provider_connections`). "Test connection" verifies + sets `last_verified_at`.
- Never expose secrets in the UI; show status + last-verified only. Disconnect revokes + marks disconnected.

---

## 6. Transcript & QA review UI (operator)

- **Redacted transcript by default.** Raw transcript/recording requires `aj_admin` **break-glass** (logged, time-boxed, tenant-notified) — surfaced as an explicit, friction-ful action, never a casual toggle.
- Turn-by-turn `call_segments` timeline (speaker, text, confidence); tool-call markers; failover markers.
- QA scoring form writes `qa_logs` (rubric version, findings); escalations sampled at a higher rate.

---

## 7. Analytics UI

- Operator: cross-tenant portfolio analytics + provider/failover health; powered by ROI marts + PostHog (operator-side product analytics).
- Client: outcome-only analytics (the 9 KPIs), business-language, per `../DESIGN.md` data-viz rules (every chart answers a business question; no vanity charts).
- **No raw PII in analytics** (PostHog tagged by `account_id` only, ADR-0018).

---

## 8. Appointment UI

- Slot selection (SMS link, web widget, or live-during-call hand-back) computed from tenant hours + blocked windows + calendar `freeBusy`.
- Confirmation + reminder cadence surfaced; status: Scheduled / Confirmed / Completed / Cancelled / No-show.
- Appointment holds respect the 10-concurrent-holds/tenant limit (API Contracts §6) to prevent oversubscription.

---

## 9. Permissions (RBAC in the UI)

| Capability | aj_admin | operator | client_admin | client_viewer |
|---|---|---|---|---|
| Cross-tenant views | ✅ | ✅ | ❌ | ❌ |
| Provision/offboard tenant | ✅ | ⚠️ (configurable) | ❌ | ❌ |
| Edit profiles (prompt/policy/routing/workflow) | ✅ | ✅ | ⚠️ (own, limited) | ❌ |
| Connect integrations | ✅ | ✅ | ✅ (own) | ❌ |
| View raw transcript/recording | ✅ break-glass | ❌ | ❌ | ❌ |
| View redacted transcript | ✅ | ✅ | per lane | per lane (read) |
| Trigger reports | ✅ | ✅ | ✅ (own) | ❌ |
| Mutate records | ✅ | ✅ | ✅ (own) | ❌ |

UI hides (not just disables) actions outside the role; the data layer enforces the same scoping server-side (defense in depth).

---

## 10. Responsive behavior (inherited)

Breakpoints + behavior per `../DESIGN.md` § 13: desktop full sidebar + 12-col + side panels; tablet icon-only sidebar + 6-col + full-page details; mobile drawer nav + stacked cards, priority order = urgent escalations → recovered revenue → leads needing review → recent activity → nav.

---

## 11. White-label implications

| Capability | MVP | Phase 2 (v0.3) | Future (v1.0) |
|---|---|---|---|
| Tenant theming (logo, name) | — | Basic (theme vars) | Full |
| Custom domain | — | Wildcard `*.responseos.app` | Per-tenant custom domain |
| Partner branding (white-label OS) | — | — | Full partner branding + tenant RBAC for branding |
| Branding controlled by | — | operator | tenant `client_admin` (scoped) |

White-label reuses the same components + APIs; only domain, theme variables, brand assets, and RBAC vary (per `../DEPLOYMENT.md` multi-tenant model). No forked UI per tenant.

---

## 12. State handling (inherited, enforced)

Every major page implements **empty / loading / error** states (`../DESIGN.md` § 15): skeletons (not spinners), plain-language errors, missing-data explanations ("Connect your CRM to enable revenue attribution"), never raw error codes/stack traces to clients.

---

## 13. Assumptions & open questions

**Assumptions:** the v0.2 UI rebuild against `../DESIGN.md` tokens lands in closeout; OAuth connect flows for HubSpot/Google are feasible in the App Router; provider/failover health can be surfaced from ledger + observability without leaking PII.

**Open questions:** (1) does the client portal ever surface "AI provider" at all, or stay fully abstracted (leaning fully abstracted); (2) Readiness Assessment as a public unauthenticated flow vs gated; (3) which white-label controls move to tenant self-serve at v1.0.

---

*ResponseOS Frontend Spec — AJ Digital LLC / Audio Jones. Documentation phase only.*
