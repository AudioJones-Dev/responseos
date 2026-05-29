# Codex Execution Prompt — Exec 0B-2: `VoiceProvider` interface + deterministic mock adapter

> This file is the **Codex-ready execution prompt** for Exec 0B-2. Copy its body into
> Codex to run the task. Unlike Exec 0A/0B-1 (documentation-only), this task **does**
> author runtime code — but **mock-only**: a provider-neutral TypeScript interface and a
> deterministic mock adapter under `lib/providers/voice/`, plus unit tests. **No live
> provider, no gateway server, no schema, no secrets.**

---

## Role & mandate
You are Codex working in the `responseos` repository. Your job for this task is to land
the **provider-abstraction skeleton** for voice: a single provider-neutral
`VoiceProvider` TypeScript interface and a **deterministic mock** implementation under
`lib/providers/voice/`, unit-tested, that compiles and runs with **zero keys**.

This is task **EX0B-2** from `docs/product/RESPONSEOS_IMPLEMENTATION_PLAN.md` §5 work
item 2 and §12 (`EX0B-2`; maps to backlog `E2-S2`). Its parent phase (Exec 0B —
Foundational architecture setup) has entry gate "Exec 0A exit met"; EX0B-1 (the canonical
module-boundary map, PR #22) is **merged** and reserves `lib/providers/voice/` as the
planned home for this interface + mock. EX0B-2 fills that reserved home and **nothing
else**. Per the dependency map (§7), EX0B-2 depends on EX0B-1 and unblocks EX1-T3 (the
mock voice-gateway skeleton) — but you do **not** build T3 here.

The interface shape is specified in `docs/architecture/RESPONSEOS_BACKEND_SPEC.md` §4
("Provider abstraction layer"). Implement to that shape; do not invent a different one.

## This is EX0B-2 ONLY — what is explicitly NOT in scope
The following are **separate, later tasks or deferred v0.3 work**. Do not start, stub, or
pre-build them here:
- **No Grok adapter.** ADR-0012 names Grok Voice as the primary realtime provider; it is
  v0.3 work, gated. Do not add it, import its SDK, or stub it.
- **No OpenAI Realtime adapter** (the ADR-0012 fallback). Same gate; do not add it.
- **No Twilio Media Streams**, no Retell/Vapi/Bland live wiring, no live numbers, no live
  signature validation against real traffic.
- **No Redis** — no client, no session store, no dependency, no config.
- **No gateway server / entrypoint.** The separately-runnable Node.js voice gateway is
  **EX1-T3**. EX0B-2 produces the interface + mock the gateway will later consume; it does
  **not** create a server, a `main`, a health endpoint, a start script, or a socket.
- **No live provider calls** of any kind, and **no network I/O**.
- **No event-ledger writer and no ledger writes.** Wiring the mock to the canonical event
  ledger is **EX1-T2a / EX1-T3**. You may *name* canonical event types from the Event
  Schema in types/comments for alignment, but you write nothing to any ledger here.
- **No config loader and no `.env.example` changes** — that is **EX0B-3**.
- **No test-convention documentation** — that is **EX0B-4**.

## Absolute constraints (hard stops — violating any of these fails the task)
1. **Mock-only (ADR-0001).** The only `VoiceProvider` implementation you create is the
   deterministic mock. It must boot and run with **zero** environment variables set. No
   real keys, no live transport, no network calls.
2. **No live provider integrations** (ADR-0012). No Grok, no OpenAI Realtime, no Twilio
   Media Streams, no Retell/Vapi/Bland live code. The existing empty `lib/providers/*`
   stubs stay untouched.
3. **No new runtime dependencies.** Implement in plain TypeScript using what is already in
   `package.json` (the repo uses `zod` if you need runtime validation, but prefer plain
   types here). Do **not** add Redis, ws, provider SDKs, or anything else.
4. **No schema, migration, or seed changes.** No `prisma/` edits of any kind. This task is
   data-layer-free; the `integration` CI job must be unaffected.
5. **No secrets.** No real keys anywhere; do not touch `.env.example`.
6. **No Firebase** — no dependency, import, or config, ever.
7. **No gateway server and no second service split.** The voice gateway is the *only*
   sanctioned split (ADR-0013) and it is **not** built in this task. Create no entrypoint,
   no server, no health route, no start script.
8. **Determinism is an acceptance criterion, not a nicety.** The mock must produce the
   **same output for the same input** on every run: stable IDs (derive from input or a
   seeded counter — **no `Math.random`**), fixed or injectable timestamps (**no bare
   `Date.now()`/`new Date()`** that leaks wall-clock into output), no ordering nondeterminism.
9. **Scope discipline (AGENTS.md).** No abstractions beyond what the interface + mock + its
   tests require. No error handling for scenarios that can't happen. Default to no comments;
   add one only where the *why* is non-obvious.
10. Do not relitigate accepted ADRs (ADR-0001, ADR-0002, ADR-0011 → ADR-0018). Treat them
    as fixed inputs. GitHub issues/milestones are out of scope.

## Step 1 — Start from current default branch and inspect the real tree
- Start from the latest commit on the default branch (EX0B-1 / PR #22 is merged). Confirm
  HEAD, branch, and a clean working tree before you begin.
- Confirm the live preconditions hold, reporting what you observe (not what you assume):
  - `lib/providers/voice/` does **not** exist yet (EX0B-1 reserved it as "planned but
    absent today").
  - The sibling provider stubs (`bland/`, `ghl/`, `hubspot/`, `n8n/`, `resend/`, `retell/`,
    `stripe/`, `twilio/`, `vapi/`) are empty (`.gitkeep` only) and `webhook-helpers.ts`
    exists. Do not modify them.
  - The test layout: unit tests live in `tests/unit/**/*.test.ts` (run by
    `vitest.config.ts`); integration tests in `tests/integration/**` (separate config).
    The `@` path alias maps to repo root.
  - Domain types live in `types/*` (re-exported via `types/index.ts`) with `MockX(...)`
    factory helpers; deterministic fixtures live in `lib/mock/*`. Note these conventions —
    you will mirror their *style*, but the voice-provider shapes are gateway-internal
    provider-abstraction types, so **co-locate them in `lib/providers/voice/`** rather than
    polluting the global domain `types/` barrel (keep scope tight).

## Step 2 — Read these documents (source of truth)
- `docs/architecture/RESPONSEOS_BACKEND_SPEC.md` §4 — the **`VoiceProvider` interface
  shape** you must implement; §3 (session lifecycle) and §4 bullet on the mock adapter
  ("returns deterministic fixtures so the gateway boots and runs without keys").
- `docs/architecture/RESPONSEOS_MODULE_BOUNDARIES.md` — §3 `lib/providers/` row and §5
  "planned but absent today" (this task fills the `lib/providers/voice/` reservation).
- `docs/product/RESPONSEOS_IMPLEMENTATION_PLAN.md` — §3 invariants, §5 Exec 0B item 2, §7
  dependency map (EX0B-2 → EX1-T3), §9 validation workflow, §12 `EX0B-2` acceptance.
- `docs/product/RESPONSEOS_EXEC_0A_PREFLIGHT.md` — the merged **SAFE TO PROCEED** call.
- `docs/product/RESPONSEOS_BUILD_SOURCE.md` — §6 invariants (mock-first, no secrets, no
  Firebase, maintainability over premature complexity).
- `docs/architecture/RESPONSEOS_SYSTEM_ARCHITECTURE.md` — provider-abstraction boundary in
  the macro component view.
- `docs/architecture/RESPONSEOS_API_CONTRACTS.md` — only for shape/naming alignment; this
  task adds **no** API route.
- `docs/ops/RESPONSEOS_QA_VALIDATION_PLAN.md` — the validation gates restated in Step 6.
- `docs/DECISIONS.md` — ADR-0001 (mock-first), ADR-0012 (Grok/OpenAI order — the adapters
  that are OUT of scope), ADR-0013 (voice gateway is the only sanctioned split).

## Step 3 — Confirm the entry gate
EX0B-1 (module-boundary map, PR #22) is merged and the merged Exec 0A preflight concluded
**SAFE TO PROCEED**. EX0B-2 is the next unblocked Exec 0B task on the critical path. If the
live repo contradicts this (e.g. `lib/providers/voice/` already exists with an
implementation, or EX0B-1 is not actually merged), **stop and escalate** rather than
proceeding.

## Step 4 — Define the `VoiceProvider` interface + supporting shapes
Create the provider-neutral interface exactly per Backend Spec §4:

```ts
interface VoiceProvider {
  startSession(ctx: SessionContext): Promise<ProviderSession>;
  streamAudio(session: ProviderSession, frame: AudioFrame): void;
  onPartialTranscript(cb: (t: PartialTranscript) => void): void;
  onToolCall(cb: (call: ToolCall) => Promise<ToolResult>): void;
  onTurnComplete(cb: (turn: Turn) => void): void;
  endSession(session: ProviderSession): Promise<SessionSummary>;
}
```

Define the **minimum** typed shapes the interface and mock need, co-located in
`lib/providers/voice/`: `SessionContext`, `ProviderSession`, `AudioFrame`,
`PartialTranscript`, `ToolCall`, `ToolResult`, `Turn`, `SessionSummary`. Rules:
- Keep them **provider-neutral** — no Grok/OpenAI/Twilio-specific fields. Adapters (later,
  v0.3) translate vendor payloads into these canonical shapes.
- Model only what is needed to make the interface meaningful and the mock testable. Do
  **not** reproduce the full Event Schema or Data Model. You may reference canonical event
  names (e.g. `voice.session_started`, `voice.session_ended`) in a type union or comment
  for forward alignment, but emit nothing to any ledger.
- `SessionContext` should carry the tenant scope the gateway will pass (e.g. an
  `accountId`/`accountId` field and a session id) so the shape is tenant-aware by
  construction — but **derive nothing from client input** and **persist nothing**. This is
  a pure in-memory shape; tenant *enforcement* remains the data layer's job (ADR-0011),
  not this interface's.
- Strict typing: no `any`. Must pass `tsc --noEmit` and eslint.

## Step 5 — Implement the deterministic mock adapter
Add `MockVoiceProvider` (implementing `VoiceProvider`) under `lib/providers/voice/`:
- Returns **deterministic fixtures** so a consumer (the future gateway) boots and runs with
  zero keys (ADR-0001, Backend Spec §4).
- `startSession(ctx)` returns a `ProviderSession` with a **stable** id derived
  deterministically from `ctx` (or a seeded counter) — never random.
- The mock drives a **fixed, ordered sequence** of fixture events to the registered
  callbacks (`onPartialTranscript`, `onTurnComplete`, and optionally a no-op/echo
  `onToolCall`) when a session is exercised, so tests can assert exact fixture content and
  order. `streamAudio` is a deterministic no-op or fixture-advance (no real audio).
- `endSession(session)` returns a deterministic `SessionSummary` (e.g. fixed transcript
  summary, outcome, turn count) computed only from the session/fixtures.
- Determinism contract: any wall-clock or id source must be injectable (e.g. an optional
  constructor `clock`/`idSeed`) and default to a **fixed** value, so repeated runs are
  byte-identical. No `Math.random`, no bare `Date.now()` leaking into outputs.
- Provide a small barrel (`lib/providers/voice/index.ts`) exporting the interface, the
  shapes, and `MockVoiceProvider` so the future gateway has one import surface.
- No secrets, no env reads that change output, no network, no persistence.

## Step 6 — Unit tests for the mock
Add a unit test (e.g. `tests/unit/voice-provider-mock.test.ts`, picked up by
`vitest.config.ts`'s `tests/unit/**/*.test.ts` glob; use the `@` alias for imports). Cover:
- The mock **satisfies the `VoiceProvider` interface** (assigned to a `VoiceProvider`-typed
  variable; the test file compiles under the same `tsc` as the suite).
- **Determinism:** running the same session twice yields **identical** session ids,
  emitted partial transcripts, turns, and `SessionSummary` (deep-equal). This is the core
  acceptance assertion.
- **Zero-key boot:** instantiate and exercise the mock with **no** env vars set (mirror the
  `process.env` reset pattern used in `tests/unit/consumer-swap.test.ts` if you touch env
  at all — but the mock should not need env).
- Callback wiring: registered `onPartialTranscript` / `onTurnComplete` callbacks receive
  the expected fixture sequence in order; `endSession` resolves to the expected summary.
- Keep tests deterministic and fast; no timers/sleeps, no network.

## Step 7 — Documentation hygiene (small, required)
- **`docs/CHANGELOG.md`** — add a **newest-first** entry under a new
  `## Unreleased — Exec 0B-2 VoiceProvider interface + mock adapter` block, in the same
  style as the existing Exec 0B-1 entries. Mandatory.
- **`docs/architecture/RESPONSEOS_MODULE_BOUNDARIES.md`** — update the single "planned but
  absent today" bullet for `lib/providers/voice/` (§5) so the canonical map stays accurate
  now that the home exists (move it from "absent today" to "present — `VoiceProvider`
  interface + deterministic mock, EX0B-2"). Keep this edit to that one bullet (and, if
  natural, a one-row note in the §3/§4 provider coverage); do **not** rewrite the map.
- No ADR is required — EX0B-2 implements existing ADR-0001/0012/0013 decisions; it does not
  change any decision. Do **not** add or relitigate an ADR.

## Step 8 — Validation & hygiene
Run the full local gate and confirm green before opening the PR:
```bash
npm run lint        # eslint
npm run typecheck   # tsc --noEmit
npm test            # vitest run (unit) — includes the new mock test
npm run build       # next build (must succeed with zero secrets)
```
- `npm run test:integration` and the CI `integration` job are **unaffected** (no schema /
  Prisma / data-layer change) — confirm you introduced none.
- Run `git status` / `git diff --stat` and confirm the only changed paths are the new
  `lib/providers/voice/*` files, the new `tests/unit/*` test, the CHANGELOG entry, and the
  one-bullet MODULE_BOUNDARIES update. Nothing under `prisma/`, `app/`, `.env.example`, or
  `package.json` (no new dependency) should change.
- Do NOT run migrations, seeds, or any DB-mutating command.

## Step 9 — Branch, draft PR, and STOP
- Work on the designated feature branch off the latest default-branch commit; one PR.
- Commit with an imperative, scoped message (e.g.
  `feat: add VoiceProvider interface + deterministic mock adapter (EX0B-2)`).
- Open the PR as a **draft** with a summary that states this is Exec 0B-2 (mock-only
  provider-abstraction skeleton), links the Implementation Plan §5/§12 and Backend Spec §4,
  and notes "no live provider, no gateway, no schema, no secrets". Mark ready for human
  merge only when CI `validate` is green.
- Then STOP. **Do not begin EX0B-3 (config loader), EX0B-4 (test conventions), or any
  Exec 1 work (T1 rename, T2a ledger, T2b tables, T3 gateway skeleton).** Await human
  review and sign-off.

## Files likely touched
- `lib/providers/voice/index.ts` — **[new]** barrel: interface + shapes + mock export.
- `lib/providers/voice/types.ts` — **[new]** (or inline in `index.ts`) the provider-neutral
  shapes (`SessionContext`, `ProviderSession`, `AudioFrame`, `PartialTranscript`,
  `ToolCall`, `ToolResult`, `Turn`, `SessionSummary`).
- `lib/providers/voice/mock.ts` — **[new]** `MockVoiceProvider` + deterministic fixtures.
- `tests/unit/voice-provider-mock.test.ts` — **[new]** unit tests (interface conformance +
  determinism + zero-key boot).
- `docs/CHANGELOG.md` — **[exists]** newest-first EX0B-2 entry.
- `docs/architecture/RESPONSEOS_MODULE_BOUNDARIES.md` — **[exists]** one-bullet status
  update for `lib/providers/voice/`.

No `prisma/`, `app/`, `types/*` barrel, `.env.example`, or `package.json` (dependency)
changes. The exact file split inside `lib/providers/voice/` is at Codex's discretion as
long as the barrel exports the interface, shapes, and mock.

## Validation commands
```bash
npm run lint        # eslint
npm run typecheck   # tsc --noEmit
npm test            # vitest run (unit)
npm run build       # next build (boots with zero secrets)
```
`npm run test:integration` and the CI `integration` job are unaffected (no schema/data
change). CI `validate` must be green; there is no standalone `npm run validate` script —
`validate` is a CI job name.

## Risk level
**Low–moderate.** First runtime code of the arc, but mock-only, dependency-free,
data-layer-free, and behind the provider-abstraction boundary. The real risks are
**scope creep** (adding a live adapter, a gateway server, Redis, or ledger wiring) and
**nondeterminism** (random ids / wall-clock timestamps). The "NOT in scope" section, the
hard-stop constraints, and the determinism acceptance criterion exist to prevent both.

## Acceptance criteria
- [ ] `lib/providers/voice/` exists with a provider-neutral `VoiceProvider` interface
      matching Backend Spec §4 and the minimal supporting shapes, strictly typed (no `any`).
- [ ] A single `MockVoiceProvider` implements the interface, returns **deterministic**
      fixtures, and needs **zero** env vars; no other (live) adapter exists.
- [ ] No `Math.random` / bare wall-clock leaks into mock output; repeated identical-input
      runs are byte-identical (asserted by a determinism test).
- [ ] Unit test(s) under `tests/unit/` assert interface conformance, determinism, zero-key
      boot, and callback/summary wiring; `npm test` green.
- [ ] `npm run lint`, `npm run typecheck`, and `npm run build` all green; build succeeds
      with zero secrets.
- [ ] No new dependency, no `prisma/` change, no `.env.example` change, no `app/` route, no
      gateway server/entrypoint, no Redis, no live provider, no Firebase, no secrets.
- [ ] `docs/CHANGELOG.md` has a newest-first EX0B-2 entry; the `lib/providers/voice/`
      "planned but absent" bullet in MODULE_BOUNDARIES.md is updated to reflect it now exists.
- [ ] Draft PR opened referencing EX0B-2; CI `validate` green; `integration` unaffected.
- [ ] No EX0B-3 / EX0B-4 / Exec 1 work started.

## Stop condition
EX0B-2 ends when the `VoiceProvider` interface + deterministic mock adapter and their unit
tests are committed on the feature branch, the CHANGELOG and the one-bullet
MODULE_BOUNDARIES update are in, and a **draft** PR is open and green on `validate`.
**Do not** proceed to EX0B-3 (env/config loader), EX0B-4 (test conventions), or any Exec 1
work (EX1-T1 `Account` rename, EX1-T2a ledger + writer, EX1-T2b go-forward tables, EX1-T3
voice-gateway skeleton). Await explicit human sign-off.
