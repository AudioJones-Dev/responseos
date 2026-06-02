# Communications Stack Research

**Status:** Research artifact. Documentation-only. No runtime code changes.
**Added:** 2026-05-29
**Source report:** `ResponseOS_Communications_Stack_Report.pdf` (this folder)

---

## Purpose

This folder holds the research evaluating the **communications infrastructure stack** for ResponseOS — the carrier-grade voice/SMS layer, the AI agent voice layer, the iMessage channel, and the abstraction that holds them together. The report is the input for vendor selection and architectural decisions; this README is the navigation pointer.

The report does **not** modify ResponseOS implementation. It is research-only. Any provider integration, environment variable, or runtime change derived from it is a separate, scoped change.

---

## What the report evaluates

The report assesses the major candidate vendors and platform classes for ResponseOS's communications layer:

- **Telnyx** — carrier-grade SIP/voice + SMS programmable infrastructure
- **Twilio** — incumbent programmable communications platform; reference baseline
- **Vapi** — AI voice agent platform (turn-taking voice agents with LLM backbone)
- **Retell AI** — AI voice agent platform (alternative to Vapi)
- **Sendblue** — iMessage-as-a-service API for green-bubble / blue-bubble messaging
- **GoHighLevel LC Phone** — embedded telephony inside the GHL CRM
- **SMS-only platforms** — class evaluation for narrow SMS-only providers

For each vendor or class, the report covers what's in the report itself (pricing posture, reliability characteristics, integration surface area, switching cost, regulatory posture, etc.). Read the PDF for the full analysis; this README is intentionally a pointer, not a restatement.

---

## Report recommendation snapshot

Per the report's recommendation section, the evaluated direction for the ResponseOS communications stack was:

| Layer | Recommendation | Role |
| --- | --- | --- |
| **Primary carrier / SMS** | **Telnyx** | Default routing for outbound and inbound calls and SMS; ResponseOS's first-class voice/SMS provider |
| **Fallback carrier** | **Twilio** | Standby provider for failover and for regions or features Telnyx doesn't cover well |
| **AI agent layer** | **Vapi *or* Retell AI** | The AI voice agent surface that handles conversational turn-taking on top of the carrier layer. The report framed selection between Vapi and Retell AI as deferred pending head-to-head evaluation |
| **iMessage channel** | **Sendblue** (optional) | Blue-bubble messaging when iMessage is the right channel; opt-in per workflow |
| **Internal abstraction** | **ResponseOS Communications Abstraction Layer** | A thin internal layer that lets ResponseOS swap providers (Telnyx ↔ Twilio at the carrier level; Vapi ↔ Retell at the agent level) without changing call-site code. Keeps ResponseOS provider-agnostic and prevents vendor lock-in at the implementation layer |

**Research posture:** Telnyx-primary + Twilio-fallback + agent-layer-deferred-but-bounded-to-two-candidates + iMessage-optional + abstraction-layer-internal. The recommendation is a direction, not yet an implementation.

**Repo canon note:** ADR-0031 through ADR-0034 later ratified the current planning baseline: **Telnyx primary carrier, Vapi primary orchestration, Twilio failover, HubSpot default commercial system of record**, all behind the Communications Abstraction Layer. This report remains source research; current implementation canon lives in `docs/DECISIONS.md`, `docs/ROADMAP.md`, and `docs/product/RESPONSEOS_BUILD_SOURCE.md`.

Implementation decisions remain gated on (a) PRD-level scoping in ResponseOS docs, (b) explicit Audio approval, and (c) the canonical decision-log entry that authorizes the integration work.

---

## Why this lives in `docs/research/communications-stack/`

`docs/research/` is the canonical home in this repo for **inbound research that informs ResponseOS direction but is not itself part of the product**. Sibling research files include:

- `RESPONSEOS_COMPETITOR_RESEARCH.md`
- `RESPONSEOS_MARKET_RESEARCH.md`
- `RESPONSEOS_NAMING_RISK_RESEARCH.md`

This artifact (the communications stack report) extends that pattern. PDF reports get their own subfolder (here, `communications-stack/`) with a README pointer, so the markdown-search surface in `docs/research/` stays clean.

---

## Constraints honored when filing this artifact

- ✅ No runtime code modified
- ✅ No package files modified (`package.json`, `package-lock.json` untouched)
- ✅ No app routes, components, or libs modified
- ✅ No secrets or environment variables added
- ✅ No `.env*` files modified
- ✅ No dependencies added
- ✅ Pure documentation/research-only change

The change set is the new folder + this README + the PDF. Nothing else.

---

## Next steps (out of scope for this README)

This README does not commit ResponseOS to any provider. The following are downstream of further scoping:

1. **PRD-level scoping** of the ResponseOS Communications Abstraction Layer (a Vault-resident PRD per `02-PROJECTS/RESPONSEOS_NOTES.md` would name the interface contract before any provider adapter is written).
2. **Provider-readiness evaluation** for Vapi primary orchestration, Retell secondary/redundancy, and any still-open model/runtime decisions under ADR-0032.
3. **Provider account procurement** for Telnyx (primary) — pending the PRD landing.
4. **Sendblue evaluation** for the iMessage channel (when iMessage becomes a scoped workflow).
5. **Internal abstraction layer design** — interface, adapter pattern, failover semantics, test doubles.

Each of these is a separate, scoped task. None of them are authorized by adding this report to the repo.

---

## Source

The full report is `ResponseOS_Communications_Stack_Report.pdf` in this folder. The byte content was added with sha256 integrity verified at copy time:

```
sha256: 2838510b7e606689caa7ddd8f5aa59ea33a1d134879a4be9f2c454cfa9c1be34
size:   59,239 bytes
```

For context on how research artifacts feed into ResponseOS direction-setting, see the Vault-resident project notes at `G:\AJ-INTERNAL\AJ-DIGITAL-VAULT\02-PROJECTS\RESPONSEOS_NOTES.md`.
