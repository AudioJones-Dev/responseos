# Critical Path — Architecture Correction Amendment

**Date:** 2026-08-08 · **Base:** `master` @ `1e2207c` · **Amends:** [`CRITICAL_PATH.md`](./CRITICAL_PATH.md), [`CONTROLLED_DEMO_SPEC.md`](./CONTROLLED_DEMO_SPEC.md)
**Status:** planning only. Implements nothing. No provider was contacted; every provider finding below is **documentation-based and unverified against a live account.**

---

## 0. Does the audit still stand?

**Yes. No finding is withdrawn.** The evidence base was re-checked against current `master`:

- **#112 cannot have changed any finding.** Its entire surface is `package.json` (+1), `package-lock.json` (nanoid only), `docs/CHANGELOG.md` (+4). Every audit finding was drawn from `lib/`, `app/`, `prisma/`, `.github/` — none touched.
- The call → intelligence → memory → decision → action chain is still **unimplemented at every link**.
- `lib/automations/` is still an empty `.gitkeep`; the Vapi webhook is still a 9-line ack-and-discard.

**What changes is the critical path, not the diagnosis.** Two findings from this pass actually make the audit's Gate-A position *slightly worse*, not better — see §1.

---

## 1. Two corrections to the audit's own evidence

Re-verification surfaced two things the original audit scored too generously. Both are recorded here rather than quietly patched.

**1.1 — `Call` has no write accessor at all.** The audit rated A07 `PARTIAL` on the basis that "models and accessors exist; nothing writes them." That is half right. `lib/data/calls.ts` exports only `listCalls` and `getCallById`. A repo-wide grep for `db.call.create|upsert|update` returns **zero matches** — the only code that writes a `Call` row is `prisma/seed.ts` and integration tests. The same holds for `Contact`, `LeadEvent`, and `LeadQualification`: all read-only.

Consequence: **A07 requires a Prisma migration, not just wiring.** `Call` has no unique key on `provider_call_id`, so there is nothing to upsert against. Minimum surface: `@@unique([provider, provider_call_id])` on `Call` (the idempotency spine) plus `updated_at`.

**1.2 — Three incompatible qualification vocabularies already exist**, independent of Vapi:

| Source | `urgency` | timeline / status |
|---|---|---|
| `prisma/schema.prisma` | `low · medium · high` | `QualificationTimeline: same_day · this_week · this_month · unknown` |
| `lib/scoring/leadQualificationScore.ts` | `low · medium · high · urgent` | `unspecified · within_30_days · within_60_days · within_90_days · flexible` |
| `lib/validation/lead.ts` | mirrors the scorer | mirrors the scorer |

`urgent` exists in code and not in the database. This is a reconciliation-and-migration task that would exist **even if extraction were built entirely in-house**, and it belongs in A08a.

**Correction of a smaller audit claim:** `vapi` *is* already a `CallProvider` enum value. `telnyx` is not — that finding stands.

---

## 2. Provider verification results

Each claim was checked against primary vendor documentation, with corroborating sources sought and refuting evidence actively hunted.

| # | Claim | Verdict |
|---|---|---|
| 1 | Telnyx SIP/DID routes inbound PSTN directly into Vapi; no carrier webhook needed | **CONFIRMED** |
| 2 | Vapi `end-of-call-report` is sufficient as ResponseOS's primary ingestion boundary | **PARTIAL** |
| 3 | Vapi supports credential-backed server auth incl. HMAC (satisfies ADR-0009) | **PARTIAL** |
| 4 | Vapi structured outputs / call analysis can be the first extraction adapter | **CONFIRMED** |
| 5 | Vapi recording-consent plan supplies consent evidence | **PARTIAL — Enterprise-tier gated** |

### 2.1 Claim 1 — CONFIRMED, and it is the only claim that reduces scope outright

Vapi's Telnyx guide documents inbound as pure SIP: set the Telnyx trunk FQDN to `sip.vapi.ai`, set *Translated Number* to the Vapi SIP URI, register the number via `POST /phone-number` with `provider: "byo-phone-number"`. Telnyx's own integration article documents an even simpler path — import the number into Vapi with a Telnyx API key. **Neither vendor's documentation contains a carrier webhook, Call Control application, or TeXML in the inbound path.**

**But it does not generalize to "no webhook ingestion needed."** Everything ResponseOS wants to *do* with a call still arrives over HTTP — from Vapi instead of Telnyx. The work **relocates**; it does not vanish.

**Operational hazards to load onto the configuration task (do not size it as trivial):**
- Vapi's two pages describe **two mutually inconsistent inbound URI models** (`sip:<id>@sip.vapi.ai` via Translated Number, vs `{phoneNumber}@<credential_id>.sip.vapi.ai`).
- Trunk gateways are **IP-only** — FQDNs return `400`. Any omitted Telnyx signalling IP produces **401 on inbound**.
- Vapi simultaneously states it *"generally doesn't recommend IP-based authentication for SIP trunks"* on shared infrastructure — an unresolved tension in the vendor's own docs.
- Strict region pinning (`api.vapi.ai` ↔ `sip.vapi.ai`); **10 concurrent call slots by default**; codec/TLS/SRTP requirements undocumented.

Prefer the **number-import** path over BYO SIP trunk for the demo.

### 2.2 Claim 2 — PARTIAL. Two hidden tasks fall out of it

The report genuinely carries call metadata, full transcript, a structured message array, and recording pointers. That removes call-completion detection, transcript assembly, and polling-as-primary. But:

- **Artifact retention is 14 days on Pay-As-You-Go**, and recordings are private authenticated URLs (`GET /call/<id>/stereo-recording` → 302 → short-lived URL). **Vapi cannot be the system of record.** ADR-0033 already requires the ledger to be the internal SoR.
- **No documented retry, redelivery, idempotency, ordering, or replay policy exists.** The absence *is* the finding, not a research gap.

→ **Two tasks the collapse would otherwise hide:** a durable artifact fetch-and-store (the `CallTranscript.raw_ref` column already exists), and a reconciliation poller against `GET /call`.

→ **Dedupe key must be derived, not assumed:** `sha256("vapi:" + call.id + ":" + message.type + ":" + endedAt)`. Never substitute a random UUID for a missing id — that silently defeats the `dedupe_hash` unique index. A missing id is a hard `400`.

### 2.3 Claim 3 — PARTIAL, and it blocks on a spike

HMAC-SHA256 with a configurable signature header and optional timestamp header, wired via `credentialId`, is real and credential-backed. That is more than a static header compare.

**But the signed payload format is a configurable field with no documented values and no example.** The verifier therefore **cannot be written from documentation**. There is also an unresolved December-2025 report that signature headers do not arrive on a correct configuration.

→ **A ~30-minute empirical spike against the Vapi dashboard is a prerequisite** to the first PR merging. If it turns out to be a static shared secret (`X-Vapi-Secret`), the HMAC and replay machinery are **inert** and the code must say so rather than imply security it does not have. Treat the header name and scheme as **configuration, not constants**, and fail closed when unset.

### 2.4 Claim 4 — CONFIRMED, with the reduction bounded

Structured Outputs are real: define a JSON Schema, link the UUID, read `call.artifact.structuredOutputs[id].result`. That removes prompt engineering, an LLM client, JSON repair, and schema-conformance validation — genuinely days of work.

**Four bounds on the reduction:**
1. **"Validated" is doing too much work.** Shape is enforced; content is not. There is **no per-field confidence** — `successEvaluation` is a whole-call rubric, not extraction confidence.
2. **Failure and "the caller never said it" are indistinguishable.** A failed extraction silently produces a plausible low qualification score. `lib/scoring/leadQualificationScore.ts` already treats every optional input as a silent zero, so this lands in an existing sharp edge.
3. **Schemas live as UUID-addressed objects in Vapi's account, not in the repo** — a multi-tenant provisioning and versioning problem. HIPAA mode drops structured outputs entirely by default.
4. **The analysis pass runs on Vapi's own model choice** (currently Anthropic Claude Sonnet). ADR-0036 §2 prefers OpenAI-in-Vapi where configurable; this is its *fallback* branch. Anthropic appears nowhere in the `SECURITY.md` vendor matrix.

→ **Mandatory design constraints, not optional:**
- A08c's contract is **three-valued — `EXTRACTED` / `ABSENT` / `FAILED`** — decided from whether `analysis.structuredData` is present and schema-valid, *not* from whether individual fields are null. On `FAILED`, route to explicit needs-review; do not score.
- **Persist the raw `analysis` payload and transcript verbatim**, stamped with model id, Vapi schema version, and adapter version. Vapi cannot re-extract a six-month-old call against a new schema; without this, ADR-0033's recompute-from-ledger invariant breaks.
- **A08a is authored from `prisma/schema.prisma` and the product requirement, and is frozen before A08b begins.** A08b's job is to make Vapi's JSON Schema approximate the canonical schema — **never the reverse.** Without this constraint the adapter boundary does not actually prevent lock-in, and a Vapi→Retell failover (required by ADR-0032) would change more than transport.
- An **ADR addendum** recording that the extraction path takes ADR-0036's fallback, plus Vapi and Anthropic rows in the `SECURITY.md` vendor matrix.

### 2.5 Claim 5 — PARTIAL, and conditional on a plan tier nobody has verified

Vapi's docs scope the feature: *"For Enterprise customers, Vapi provides built-in recording consent plans."* The same tier boundary governs retention — PAYG is 14 days, Enterprise is configurable. **On a non-Enterprise tier the reduction is zero.**

→ **Verify the actual Vapi plan tier before banking any consent reduction.**

Four things remain ResponseOS's regardless of tier:

1. **The consent gate is over the wrong artifact as proposed.** ResponseOS persists *transcripts*, not audio. `recordingEnabled` and `transcriptPlan.enabled` are independent switches. A consent decline that stops recording does **not** stop `CallTranscript.inline_text` and `CallSegment.text` from persisting verbatim caller speech. Define the gate over the **artifact class**, enumerating every consent-sensitive artifact.
2. **`consent_records` does not exist.** It is specified in `docs/data-schema.md:265` and absent from all 22 Prisma models. That is a migration with tenant-scoped accessor, mock parity, and isolation tests — not a configuration step.
3. **"Gate processing" has no enforcement point, and the repo already contains this exact failure.** `CallTranscript.retention_lane` (`full | redacted_only | metadata_only`) and `expires_at` are persisted and round-tripped — **and enforced nowhere.** `PUBLIC_SELECT` in `lib/data/callTranscripts.ts:48` returns `inline_text` unconditionally, so a tenant marked `metadata_only` still receives full transcript text. `expires_at` is never read by any sweeper. **A compliance label that is stored and never enforced is the precedent here** — name the enforcement point before building, and test that a denied-consent report produces zero transcript/segment rows.
4. Consent semantics (per-call grant → per-contact state, revocation), jurisdiction logic, and cross-channel consent are entirely uncovered by Vapi.

**B12 keeps P0 and is promoted into the demo path.** A live demo records a prospect's voice. This is a founder/legal decision with the longest human latency in the plan — start it first. *(No legal claim is made here; this is implementation scope only.)*

---

## 3. Revised Demo MVP architecture

```
PSTN → Telnyx DID/SIP ─────────────────────────────► Vapi
                                    (carrier↔vendor; ResponseOS not in the media path)
                                                       │  authenticated server events
                                                       ▼
                                            ResponseOS ingestion boundary
                                            verify → ledger → dispatch
                                                       ▼
   RAW EVIDENCE      Call + CallSegment + CallTranscript + raw analysis payload
                                                       ▼
   CANONICAL INTEL   ResponseOS-owned schema  ◄── VapiStructuredOutputExtractor
                     (confidence + source_ref)  ◄── InternalLLMExtractor (later)
                                                       ▼
   BUSINESS OBJECTS  Contact · Lead · LeadQualification
                                                       ▼
   BUSINESS MEMORY   durable facts + provenance
                                                       ▼
   POLICY ENGINE     deterministic decision + rule_id
                                                       ▼
   ACTION            in-process sandbox task / notification / SMS draft
                                                       ▼
   CONTROL PLANE     full provenance chain
```

**Hard boundary preserved.** Vapi supplies voice runtime, transcript, call artifact, provider-level analysis, consent metadata. Those are **evidence and input**. ResponseOS owns the canonical intelligence schema, business entities, memory, provenance, decision policy, task semantics, execution and outcome state, operator control plane, and ROI attribution. Provider output is never canonical business truth.

---

## 4. Revised counts — auditable

### 4.1 Register total: 56 → 55

```
Original                                            56   (A 20 · B 20 · C 16)
  − A03  merged into A06′ (Vapi ingestion)          −1
  − A01  merged into A02′ (config, not adapter)     −1
  − A19  merged into A06′ (demo) + B07 (residual)   −1
  − C03  merged into A05′                           −1
  − C02  merged into A02′                           −1
  + A08  decomposed → A08a + A08b                   +1
  + A21  DID → tenant resolution            (NEW)   +1
  + A22  assistant-request / per-DID routing (NEW)  +1
  + A23  missed/failed-call reconciliation   (NEW)  +1
                                                   ────
Revised                                             55        A 21 · B 20 · C 14
```

### 4.2 Demo-critical: 29 → 25

X = 29 is constructed from `CRITICAL_PATH.md` §2 (17 chain nodes + 6 of the 8 "parallelizable" that the demo actually needs, excluding B03 and the founder-blocked C13) + `CONTROLLED_DEMO_SPEC.md` §4 (C02, C03, C04, C06, C07, C10).

```
X                                                   29
  − A03 −A01 −A19 −C03 −C02  (merges)               −5
  − A13  generic ledger deferred (typed FKs suffice) −1
  − C04  sandbox adapters deferred (A17′ in-process) −1
  + A08b decomposition adds one on-path item        +1
  + A21  DID → tenant resolution                    +1
  + B12  recording consent PROMOTED into demo path  +1
                                                   ────
Y                                                   25
```

**Sequential depth: 16 → 13.**

### 4.3 State this plainly

**The correction does not meaningfully shrink the register — it shrinks sequence depth, effort, and risk-front-loading.** Five tasks collapse; four appear. Three of the four newcomers (**A21** tenant resolution, **A22** per-DID routing, **A23** missed-call reconciliation) were *always* required and were merely invisible while the plan assumed a carrier webhook would supply what it never would.

Reporting **56 → 55** honestly is the point. Reporting 56 → 18 would have been the failure.

**Where the real collapse lives — effort, not count:** three `L` items leave the demo path (A08 splits with A08a off-chain; A13 deferred; A17 → `M`), two drop a size (C05 `L→M`, C10 `M→S`), against one `M` added (B12) and two `S` (A21 demo variant, A08a).

**And the chain no longer opens with its two riskiest nodes.** A01 ("first live vendor surface") and A03 ("business-mutation boundary") were positions 1 and 2. The new head — A04′/A06′ — is code the repo has three working patterns for: `lib/auth/clerk-webhook.ts`, `app/api/webhooks/clerk/route.ts`, `lib/auth/clerk-sync.ts`.

### 4.4 Per-task disposition

| Task | old_state | new_state | Reason | Evidence |
|---|---|---|---|---|
| **A01** Telnyx CarrierProvider adapter | P0, `M`, chain head | **merged → A02′** (config) | Inbound never traverses a ResponseOS carrier adapter | Vapi Telnyx SIP guide; Telnyx integration article |
| **A03** Telnyx inbound webhook + sig | P0, `M`, on chain | **merged → A06′, renamed not deleted** | Work relocates to Vapi ingestion; deleting it would leave zero record of a call | Vapi docs contain no inbound carrier webhook; `route.ts` is a 9-line stub |
| **A19** idempotency/retry | P1, `M` | **merged → A06′ + B07** | `WebhookEvent` + `dedupe_hash` unique + `WebhookProcessStatus` already migrated; `recordWebhookEvent` exists | `prisma/schema.prisma:561-580`; `lib/data/webhookEvents.ts` |
| **C02** demo phone number | P0, `S` | **merged → A02′** | Same provisioning action | — |
| **C03** demo Vapi agent | P0, `M` | **merged → A05′** | Same assistant configuration | — |
| **A08** extraction pipeline | P0, `L` | **decomposed → A08a + A08b** | Canonical schema is ResponseOS-owned and separable from any extractor | Claim 4 CONFIRMED |
| **A13** generic event ledger | P0, `L` | **deferred → P1, off demo path** | Typed FKs + `AuditLog` suffice for demo provenance | A18 must be built on typed FKs and must not assume a ledger arrives later |
| **A17** sandbox execution | P0, `L` | **rescoped → A17′, `M`** | In-process writes only for demo; no externally-reaching adapter | C04 deferred with binding trigger |
| **B12** recording consent | P1, Gate B | **P0, promoted into demo path** | A live demo records a prospect's voice; Enterprise gating unverified | Claim 5 PARTIAL |
| **A21** DID → tenant resolution | — | **NEW, P0, `S` demo variant** | Vapi events carry no ResponseOS tenant; `Call.account_id` is non-nullable | `ProviderConnection` exists and is unwired |
| **A22** assistant-request / per-DID routing | — | **NEW, P1, deferred** | Static dashboard assignment covers only single-assistant | Vapi inbound settings are static |
| **A23** missed/failed-call reconciliation | — | **NEW, P1, deferred** | Vapi never fires for carrier-failed/abandoned calls; no documented redelivery | Claim 2 PARTIAL |
| **A07** call persistence | `PARTIAL`, `S` | **`S` → `M`, migration required** | No `Call` write accessor exists; no unique key to upsert against | grep `db.call.create\|upsert\|update` → 0 |
| **A08a** canonical schema | — | **absorbs vocabulary reconciliation** | Three incompatible vocabularies exist pre-Vapi | §1.2 |

### 4.5 Reduction explicitly NOT taken

**The audit's `CarrierProvider`/`VoiceAgentProvider` CAL (PR #108) is not adopted as-is.** Independently confirmed against its own source:

- `CarrierProvider` is `placeOutboundCall` / `hangupCall` / `getCallStatus` — **100% outbound.** On the inbound slice not one method would ever be called.
- `VoiceAgentProvider` is `startSession` / `appendTurn` / `endSession` — **the control flow is inverted.** Vapi drives the conversation and pushes an `end-of-call-report`; ResponseOS never calls `appendTurn`.
- `VoiceAgentSummary` embeds `intent` and `qualificationStatus` — **provider output as canonical business truth**, the exact boundary violation this amendment forbids. Its `"qualified" | "unqualified" | "unknown"` cannot round-trip to Prisma's `qualified | maybe | unqualified | spam`.

**New deferral for the audit's §7 list:** the streaming `VoiceProvider` interface in `lib/providers/voice/` (`streamAudio(AudioFrame)`, `onPartialTranscript`, `onTurnComplete`). Under Telnyx→SIP→Vapi, RTP flows carrier↔Vapi and **never reaches ResponseOS**. Mark dormant; do not extend it for A04′. It is the interface a voice gateway would need, and the gateway is already deferred (ADR-0036).

---

## 5. Five parallel execution lanes

| Lane | Tasks | Blocked on | Owns / freezes |
|---|---|---|---|
| **L1 — Ingress** | A02′, A05′, A21, A04′, A06′, A07 | **Nothing — start now** | **Ingestion Contract** |
| **L2 — Intelligence** | A08a, A08b, A09, A10, A11 | **Nothing** — A08a is fixture-driven; the fixture *is* the contract | **Canonical Extraction Schema** |
| **L3 — Memory · Decision · Action** | A14, A15, A16, A17′, A18 | **HARD BLOCK** on contracts 2 + 3 | **Provenance** + **Decision** contracts |
| **L4 — Surface** | C05′, C06, C07, C10′ | **HARD BLOCK** on contract 5 | consumes all four |
| **L5 — Demo env + governance** | C01, C08, C14, A20, **B12** | Nothing — **B12 has the longest human latency, start it first** | demo baseline + reset semantics |

### Contracts frozen before L3 / L4 may start

1. **Ingestion Contract** *(L1, before A07 has a consumer)* — ResponseOS-owned `IngestedCall`. Vendor shapes must not leak past this boundary. **E.164 normalization is ResponseOS's job** — Vapi's BYO examples set `numberE164CheckEnabled: false` while Telnyx import requires strict E.164.
2. **Canonical Extraction Schema** *(L2, before A09/A14/A15/C06)* — the `CONTROLLED_DEMO_SPEC` §2 field set, each field carrying `confidence` and `source_ref`. **This is the contract that makes the Vapi-as-extractor decision safe.**
3. **Provenance Contract** *(L3, before A14–A18 and C07)* — `{source_kind, source_id, extraction_id, memory_ids[], decision_id, rule_id}`. **Replaces A13's role.**
4. **Decision Contract** *(L3, before A16/A17′/C05′)* — `{decision_id, rule_id, rule_version, inputs_ref[], selected_action, rationale_text}`. `rule_id` is what the runbook's step 8 renders; a contract field, not a log line.
5. **Read Contract** *(before any L4 work)* — one tenant-scoped `getCallLifecycle(callId)` returning the whole chain in one query, conforming to the existing `Result<T>` envelope (`lib/data/result.ts`), not a new one.

**A prerequisite the collapse hides:** every piece of this path arrives over HTTP from Vapi, so it needs a **publicly reachable, TLS-terminated, stable-URL receiver**. Gap **D1** (no hosted deploy artifact) is therefore a hard prerequisite of the first live call — which is why the staging capability (PR #110) sequences *before* live-call rehearsal, not after.

**Ops tasks the collapse also hides:** capture the Vapi provisioning calls as a checked-in idempotent script so vendor-console config is diffable and reproducible; add a **synthetic inbound smoke check** run before any demo, since unit tests cannot cover SIP routing.

---

## 6. Recommended first implementation PR

**`feat: Vapi server-event ingestion (signature + ledger + call persistence)`** — implements **A06′**, carries **A21's demo variant**, lands the **Ingestion Contract**.

**Why first:** it is where the corrected architecture first changes what gets written; it converts the only ingress from a 9-line ack-and-discard into a real boundary; every piece of scaffolding it needs already exists; and it is **fully testable from a fixture with a test secret — no live provider, no real secret, no external call.**

- `lib/providers/vapi/verify.ts` — HMAC-SHA256 over the **raw body**, constant-time compare with explicit length pre-check, replay window, injectable clock. **Copy the shape of `lib/auth/clerk-webhook.ts`; do not import it** — it is hard-coded to Svix. `node:crypto` only, no new dependency.
- `lib/providers/vapi/types.ts` — the Ingestion Contract as a Zod schema (`zod` already a dependency).
- `lib/providers/vapi/ingest.ts` — ledger-first: `recordWebhookEvent(...)` **before** any mutation; treat `duplicate` as terminal **only** when the existing row is `processed` (rows in `received`/`error` must re-reconcile, since retries reuse the id); then resolve tenant; then write through tenant-scoped accessors.
- `app/api/webhooks/vapi/call-ended/route.ts` — rewrite in `app/api/webhooks/clerk/route.ts` order: secret unset → **503, zero mutation**; `await req.text()` **before** any parse; verify → **401** on failure; then parse → **400** fallback. No middleware change needed (`/api/webhooks` is already in `PUBLIC_PREFIXES`).
- **A21 demo variant** — resolve `account_id` from a config map keyed by dialed E.164, loudly demo-only. **Unmapped DID → `WebhookEvent` with `process_status: "rejected"` and zero `Call` rows. Never fall back to a default tenant.**

**Tests:** unit mirroring `tests/unit/clerk-webhook.test.ts` (happy path, tampered payload, wrong secret, missing headers, stale timestamp); integration asserting fixture → 1 `Call` + N `CallSegment` + 1 `CallTranscript` with correct `account_id`, **redelivery writes exactly once**, unmapped DID → one `rejected` event and zero `Call` rows.

**Not in PR 1:** no Telnyx code, no live Vapi call, no extraction, no Prisma migration, no secrets, no `master` push. Branch off `master`, open **draft** until CI green, then human merge.

**Prerequisite:** the ~30-minute signature spike (§2.3) must complete before PR 1 merges. If the scheme is a static shared secret, the HMAC machinery is inert and the code must say so.

**Gate note:** PR 1 adds a receiver and a decoder. No outbound provider call; the app still boots with zero Vapi env vars (503 fail-closed). Authorable as mock-safe. **Turning on a real secret in a real environment is the Q3 v0.3 authorization and is not in this PR.**

---

## 7. Evidence caveats

- **Nothing was verified against a live Vapi or Telnyx account.** All provider findings are documentation-based.
- Two claims that would produce the largest *further* reductions — Vapi structured outputs as extractor, and the consent plan as consent evidence — are **CONFIRMED-with-bounds** and **PARTIAL-conditional-on-tier** respectively. The reductions taken are bounded accordingly; nothing is banked on the unverified parts.
- The register and this collapse mapping must be reflected in `dashboard/dashboard-data.json` per the `AGENTS.md` contract, so the disposition of every changed task is traceable outside this document.
