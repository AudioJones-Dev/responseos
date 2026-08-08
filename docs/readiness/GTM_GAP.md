# GTM Gap

Companion to [`CURRENT_STATE_AUDIT.md`](./CURRENT_STATE_AUDIT.md) §8 (claim-by-claim evidence) and
[`CONTROLLED_DEMO_SPEC.md`](./CONTROLLED_DEMO_SPEC.md) (the demo MVP).

## Gate C — GTM READY: ~10% complete

> AJ Digital can convincingly sell the system because prospects see the business outcome rather than
> hear about the architecture.

| Requirement | Status |
|---|---|
| controlled demo environment | SCAFFOLDED (static storyboard, zero DB access) |
| demo tenant | MISSING |
| dedicated demo phone number | MISSING |
| repeatable mock-call scenario | MISSING (no call path exists) |
| deterministic sample dataset | PARTIAL (171-line fixture, display-only) |
| call intelligence visualization | MISSING |
| action execution visualization | MISSING |
| before/after business story | PARTIAL (narrated by the storyboard, not produced by the system) |
| ROI attribution | PARTIAL (`RevenueMetrics` model exists, unpopulated) |
| outcome dashboard | MISSING |
| onboarding workflow | DOCUMENTED ONLY |
| pricing/package mapping | **BLOCKED — founder decision D1** |
| product messaging | PARTIAL (two competing narratives, neither canonical) |
| sales demo script | MISSING (draft proposed in the demo spec) |
| demo reset mechanism | MISSING |
| failure-safe demo mode | PARTIAL (the static walkthrough is a usable fallback) |
| sample reports | MISSING |
| proof/evidence artifacts | MISSING |
| pilot onboarding checklist | PARTIAL (#109 §5 staged ladder) |
| pilot success metrics | MISSING |

## The central GTM problem

**The sales narrative is not supported by the implementation.** Per `CURRENT_STATE_AUDIT.md` §8, all
six functional claims — understands, extracts, remembers, decides, executes, maintains provenance —
are currently **unsupported by code**. The two partially-supported claims (shows the operator,
measures outcomes) rest on UI and a model that no call populates.

This is not a copywriting problem. The narrative describes the intended product accurately. It
cannot be *demonstrated*, and a demo that can only be narrated is a pitch, not proof.

## The positioning blocker (D1)

Three pricing/positioning taxonomies coexist and nothing decides what a prospect is quoted:

1. **"AI Revenue Recovery Platform"** — what the code, the `Engagement` enum, and the shipped
   marketing site implement
2. **"Managed Business Memory System"** — claimed ratified by ADR-0022/0028 in the GTM roadmap
3. **A third hardcoded tier set** in the admin billing mock

PR #105 (unmerged) proposes a reconciliation: the two as *stages of one progression* rather than
competing brands. **Ratifying or rejecting that framing is the decision** — and it is doctrine, so
it is the operator's call, not an engineering task.

Every sales asset, CTA, brand artifact, and pricing page is downstream of it.

## What GTM work is genuinely parallelizable now

None of these depend on the Gate-A chain and can start immediately:

- **C13** resolve positioning (decision, not implementation)
- **C14** sales demo script — a full draft exists in `CONTROLLED_DEMO_SPEC.md` §6
- **C01** demo tenant + fixtures
- **C08** demo reset tooling
- **C16** pilot success metrics definition

Starting these now means that when the Gate-A chain lands, the demo is a matter of connecting a UI to
working data rather than inventing the entire go-to-market surface from scratch.
