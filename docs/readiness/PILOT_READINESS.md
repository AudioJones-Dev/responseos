# Pilot Readiness Gate

## Can we onboard one paying pilot tomorrow?

# **NO**

---

## Blockers only

These are the items that make a paid pilot impossible, not improvements. Nice-to-haves are
deliberately excluded — see [`CRITICAL_PATH.md`](./CRITICAL_PATH.md) §7 for what is being deferred.

| # | Blocker | Evidence | Gate |
|---|---|---|---|
| 1 | **No carrier.** Telnyx has no adapter, enum, env var, or webhook route — it exists only as display strings in demo fixtures. | `lib/providers/telnyx/` does not exist | A01, A03 |
| 2 | **No voice agent.** `lib/providers/vapi/` is an empty directory. | `.gitkeep` only | A04 |
| 3 | **Call ingestion discards data.** The Vapi webhook is a 7-line ack stub with an unimplemented signature TODO. | `app/api/webhooks/vapi/call-ended/route.ts` | A06 |
| 4 | **No webhook signature validation** on any provider except Clerk. ADR-0009 makes this mandatory before any business mutation. | 8 routes with `// TODO: verify …` | A03, A06 |
| 5 | **No extraction.** Nothing converts a transcript into structured information. | repo-wide grep returns only auth files | A08 |
| 6 | **No business memory.** No model, no write path — the central product claim is unimplemented. | no `Memory` model among 22 | A14 |
| 7 | **No decision or action layer.** `lib/automations/` is an empty `.gitkeep`. | directory listing | A15–A17 |
| 8 | **No call-recording disclosure/consent configuration.** Recording calls without a configured consent posture is a legal exposure, not a feature gap. | no consent config in schema or code | B12 |
| 9 | **No observability.** A pilot failure would be invisible — no error tracking of any kind. | no dependency in `package.json` | A20 |
| 10 | **No tenant configuration** for business hours, service area, or escalation. The system cannot be told how the client's business actually operates. | no config surface | B01 |
| 11 | **No data export or offboarding path.** Standard pilot-contract expectations that cannot currently be met. | no implementation | B16, B17 |
| 12 | **Pricing is unresolved.** Three conflicting taxonomies exist and nothing decides what a prospect is quoted. **Founder decision D1.** | PRD vs GTM roadmap vs admin billing mock | C13 |

---

## What is NOT a blocker

Stated explicitly to prevent scope creep into the pilot:

- Tenant isolation — **already real and tested** (21 tenant-matrix tests, enforced at the accessor layer)
- Auth — Clerk wired, `RESPONSEOS_REQUIRE_AUTH` fail-closed gate exists and was verified live
- Database schema breadth — 22 models and 8 migrations already exceed pilot needs
- Deployment containment — `vercel.json` disables master auto-deploy; correctly gated
- Mock-first boot — the app runs with zero secrets, as required

---

## The honest summary

The blocking work is **not** hardening, scale, or polish. It is that the **product layer has not been
built yet** — the substrate beneath it has. Of the 12 blockers, 7 are Gate-A implementation tasks
that do not exist in any form, 1 is a legal-posture gap, and 1 is a founder decision.

Nothing here is a surprise given the mock-first discipline the repository deliberately maintained.
The v0.2 substrate was built correctly and on purpose. What follows is the first genuinely
product-shaped phase of the build.
