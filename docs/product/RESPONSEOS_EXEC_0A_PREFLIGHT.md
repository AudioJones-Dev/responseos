# RESPONSEOS Exec 0A Preflight — Implementation Sequencing & Repo-Grounded Readiness

- **Owner:** Platform / Architecture
- **Status:** Canonical (planning) — no implementation authorized by this document
- **Last updated:** 2026-05-27 (UTC)
- **Read first:** `docs/product/RESPONSEOS_IMPLEMENTATION_PLAN.md`, `docs/product/RESPONSEOS_PHASE_PLAN.md`, `docs/product/RESPONSEOS_BUILD_SOURCE.md`, `docs/DECISIONS.md`, `docs/SECURITY.md`
- **Governing ADRs:** ADR-0001, ADR-0002, ADR-0009, ADR-0011, ADR-0012, ADR-0013, ADR-0014, ADR-0015, ADR-0016, ADR-0017, ADR-0018

## 1) Current repo state

- **Git state at inspection start:** branch `work`, HEAD `829d858` (base inspected for this preflight), working tree clean.
- **Default-branch parity check:** this local checkout has no upstream tracking configured for `work`, but git history includes `e208c61` (PR #17 docs set) and `829d858` (PR #18 implementation-plan docs), matching the Exec 0A entry-gate statement.
- **Entry gate (Exec 0A):** confirmed in local history as met (`#17` then `#18` merged commits present), consistent with `RESPONSEOS_IMPLEMENTATION_PLAN.md` sequencing assumptions.

### Observed top-level layout

`.git`, `.github`, `app`, `components`, `docs`, `lib`, `node_modules`, `prisma`, `public`, `tests`, `types`.

### Observed key trees

- **`lib/` present today:** `auth/`, `automations/`, `config/`, `data/`, `db/`, `mock/`, `notifications/`, `providers/`, `revenue/`, `scoring/`, `validation/`, `serverOnlyGuard.ts`.
- **`lib/providers/` present today:** `bland/`, `ghl/`, `hubspot/`, `n8n/`, `resend/`, `retell/`, `stripe/`, `twilio/`, `vapi/`, plus `webhook-helpers.ts`.
- **`prisma/` present today:** `schema.prisma`, `seed.ts`, `migrations/` (`0001_v0_2_foundation`, `migration_lock.toml`, `.gitkeep`).
- **`app/` present today:** route groups `(marketing)`, `(client)`, `(admin)` and API surface under `app/api/*` including webhook routes.
- **`tests/` present today:** `unit/`, `integration/`, `e2e/`, `factories/`.
- **`types/` present today:** typed domain entities including `organization.ts`.
- **`docs/` present today:** architecture, ops, product, ADR/changelog/readme and supporting docs.

### Expected by plan, absent today

- `lib/providers/voice/` (`VoiceProvider` interface + deterministic mock target for EX0B-2) — **absent**.
- Explicit typed config-loader module in `lib/config/` matching EX0B-3 acceptance language — **absent as explicit contract artifact**.
- Canonical event-ledger writer module under `lib/` for EX1-T2a — **absent**.
- Voice-gateway dedicated runnable entrypoint/package for EX1-T3 — **absent**.

## 2) Implementation dependency order

Validated against `RESPONSEOS_IMPLEMENTATION_PLAN.md` §7/§8 critical path:

`A1 → A2 → B1 → B3/B4 → T1 → T2a → T3`

- This path is consistent with current repo state and missing artifacts: B1/B3/B4 are prerequisite groundwork before schema-level and gateway work.
- T1 (`Organization`→`Account`) remains the major unblocker: current schema/types/data/tests still center `Organization` + `organizationId`, confirming large dependency fan-out into T2a/T3.
- No repo evidence contradicts running B2 in parallel after B1, or T2b in parallel after T2a/T1 dependencies clear.

## 3) Risk register

| ID | Risk | Repo-grounded impact | Mitigation |
|---|---|---|---|
| R1 | Rename blast radius (`Organization`→`Account`) | Current codebase has broad `Organization` and `organizationId` usage across schema, types, data accessors, tests, and routes. Partial rename will break compile/tests and tenant semantics. | Land EX1-T1 as one atomic PR: migration + schema/types/data/auth/tests + stale-reference sweep + gates green. No piggyback features. |
| R2 | Ledger writer scope creep | No ledger module exists yet; risk is first implementation absorbs domain/provider logic. | Keep EX1-T2a writer narrowly scoped to envelope write, dedupe key/idempotency, minimal emit API; provider-specific transforms stay at adapter boundary (ADR-0012). |
| R3 | Gateway skeleton drifts into realtime implementation | No gateway entrypoint exists; new code could overreach into sockets/audio/Redis/live adapters. | Enforce EX1-T3 acceptance literally: health + mock provider resolution + single mock ledger write only; reject audio/socket/Redis runtime/live provider code. |
| R4 | Premature service split beyond sanctioned gateway | Modular monolith is current shape; uncontrolled extra split increases ops complexity before readiness. | Restrict split work to the single sanctioned voice gateway boundary (ADR-0013); keep other capabilities in-monolith for this arc. |
| R5 (new) | Local branch/default-branch ambiguity | This checkout has no upstream/default reference metadata; sequencing work can accidentally target stale base. | Before EX0B implementation PRs, require explicit fetch/rebase check against the repo default branch in contributor workflow and PR checklist. |

## 4) File impact map

### Exec 0B (planning-derived)

| Task | File / area | Exists | Risk | Why |
|---|---|---:|---|---|
| EX0B-1 | `lib/*` responsibility map doc artifact (likely under `docs/product/` or architecture docs) | [new] | low | Documentation-only boundary mapping. |
| EX0B-1 | `lib/providers/*` mock fallback statement coverage | [exists] | low | Verification/documentation pass over existing stubs. |
| EX0B-2 | `lib/providers/voice/` | [new] | med | New abstraction must align with Backend Spec §4 and remain mock-only. |
| EX0B-2 | Unit tests for voice mock behavior (under `tests/unit/`) | [new] | med | Determinism contract required. |
| EX0B-3 | `.env.example` | [exists] | med | Contract updates can drift from actual boot/runtime expectations. |
| EX0B-3 | `lib/config/*` typed loader | [exists]/[new] | med | Must default safely to mock path without secrets. |
| EX0B-4 | `vitest.config.ts` | [exists] | low | Conventions already split unit coverage; mostly documentation/tightening. |
| EX0B-4 | `vitest.integration.config.ts` | [exists] | low | Isolation conventions already explicit (`isolate:false`, serial integration). |
| EX0B-4 | `tests/` conventions docs and example isolation test | [exists]/[new] | med | Tenant isolation guardrails depend on repeatable patterns. |
| EX0B-4 | `prisma/seed.ts` ↔ `lib/mock/*` contract note | [exists] | med | Seed/mock drift can make integration nondeterministic. |

### Exec 1 (planning-derived)

| Task | File / area | Exists | Risk | Why |
|---|---|---:|---|---|
| EX1-T1 | `prisma/schema.prisma` | [exists] | high | Root tenant model rename + relation propagation is structurally invasive. |
| EX1-T1 | `prisma/migrations/*` | [new] | high | Rename migration correctness and deploy safety are critical. |
| EX1-T1 | `prisma/seed.ts` | [exists] | high | Seed must follow renamed model/fields to keep integration booting. |
| EX1-T1 | `lib/data/*` | [exists] | high | Tenant scope API contracts currently keyed by `organizationId`. |
| EX1-T1 | `lib/auth/*` | [exists] | high | Session-derived scope must stay authoritative and renamed consistently. |
| EX1-T1 | `types/*` (notably `types/organization.ts`) | [exists] | high | Domain type rename ripples through compile boundary. |
| EX1-T1 | affected routes/tests/factories | [exists] | high | API param names and fixture shapes currently include `organizationId`. |
| EX1-T2a | `prisma/schema.prisma` + migration | [exists]/[new] | high | Ledger table is foundational persistence primitive. |
| EX1-T2a | new ledger writer module under `lib/` | [new] | high | Must be idempotent and architecture-constrained. |
| EX1-T2a | `prisma/seed.ts` + tests | [exists] | med | Seed and replay/idempotency tests validate envelope assumptions. |
| EX1-T2b | `prisma/schema.prisma` + migration | [exists]/[new] | med | Additive tables but broad forward-compat surface. |
| EX1-T2b | `prisma/seed.ts` + per-table isolation tests | [exists]/[new] | med | Ensures tenant-safe data shape for each new table. |
| EX1-T3 | voice gateway entrypoint + dedicated package/start script | [new] | high | New runtime surface can violate mock-only/no-realtime limits if unscoped. |
| EX1-T3 | health endpoint + mock `VoiceProvider` wiring + single ledger emit | [new] | high | Must prove integration seam without introducing live/runtime complexity. |

### EX1-T1 rename blast radius (current-state evidence)

- `Organization` literal references (repo-wide searched scope: `prisma`, `lib`, `tests`, `types`, `app`, `docs`): **43** matches.
- `organizationId` references in the same scope: **112** matches.
- High-impact locations include:
  - `prisma/schema.prisma` model definition.
  - `prisma/migrations/0001_v0_2_foundation/migration.sql`.
  - `types/organization.ts` and `lib/data/organizations.ts`.
  - `lib/auth/session.ts` tenant-scope enforcement and `lib/data/*` accessor parameters.
  - Route `app/api/reports/client/[organizationId]/route.ts`.
  - Integration/unit tests and factories keyed on `organizationId`.

## 5) Validation commands

### Local commands (current scripts)

- `npm run lint` → eslint
- `npm run typecheck` → `tsc --noEmit`
- `npm test` → `vitest run` (unit config)
- `npm run build` → `next build`
- `npm run test:integration` → `vitest run --config vitest.integration.config.ts`
- Prisma seed command executed directly in CI: `npx prisma db seed` (package points seed to `tsx prisma/seed.ts`).

### CI jobs (`.github/workflows/ci.yml`)

- **`validate` job** (CI job name, **not** an npm script): `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
- **`integration` job**: Postgres 16 service container + shadow DB creation + `npx prisma migrate diff ... --exit-code` + `npx prisma migrate deploy` + `npx prisma db seed` + `npm run test:integration` + `npm run build`.

### Unit vs integration split confirmation

- `vitest.config.ts` includes only `tests/unit/**/*.test.ts`, excludes integration/e2e.
- `vitest.integration.config.ts` includes only `tests/integration/**/*.test.ts`, excludes unit/e2e, and runs non-parallelized fork pool with `isolate: false`.

## 6) Recommended first implementation PR

**Recommendation:** Start Exec 1 with **EX1-T1 (`Organization`→`Account` rename + tenant-scoping hardening)** as a single atomic PR.

**Why:** It is the highest-fan-out blocker evidenced by current schema/type/data/test usage counts and is explicitly the plan’s critical-path pivot before T2a/T3.

**Atomic PR scope (and only this scope):**

1. Migration + `prisma/schema.prisma` rename changes.
2. Regenerated Prisma client artifacts as required by repo workflow.
3. `lib/data/*`, `lib/auth/*`, `types/*`, directly dependent routes/tests/factories updated for tenant naming/scope semantics.
4. Stale-reference sweep for code paths in active scope.

**Acceptance criteria:**

- No stale `Organization`/`organizationId` identifiers where the canonical model should be `Account`/`accountId`.
- Tenant scope derived from session remains authoritative; client-supplied cross-tenant attempts denied.
- Lint/typecheck/unit/build/integration gates green in CI (`validate` + `integration`).

## 7) Blockers / open questions

- **B1 — v0.3 authorization** (carried): post-T3 live integrations/runtime expansions remain blocked.
- **Q1** (carried): voice-gateway hosting target decision deferred to Phase 2.
- **Q2** (carried): HubSpot-default vs GoHighLevel-default pilot priority deferred to v0.3.
- **Q3** (carried): whether `call_sessions`/`tool_calls` land in T2b now vs Phase 2 start.
- **New blocker from repo inspection:** local git checkout lacks upstream/default-branch tracking metadata; implementation PRs should verify base freshness explicitly before code work.

## 8) Explicit recommendation

**SAFE TO PROCEED**

The repository state aligns with the Implementation Plan’s sequencing assumptions: required prerequisite artifacts for later phases are absent in exactly the places Exec 0B/1 are meant to introduce them, and no contradictory structure was found. The critical path remains valid with EX1-T1 as the dominant unblocker. Primary risks are known and can be controlled with strict task scoping, mock-only enforcement, and atomic PR boundaries.
