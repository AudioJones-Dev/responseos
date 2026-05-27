# Changelog — ResponseOS

All notable changes to this repo. Newest first. Format is a lightweight take on Keep-a-Changelog. Each entry links to the merge commit; PR numbers reference `audiojones-dev/responseos`.

> Project versioning is **internal milestone** (v0.1, v0.2 Phase A–D, …) rather than semver. See [`ROADMAP.md`](./ROADMAP.md) for the version table and what each milestone means.

## Unreleased — implementation plan (Execution Phases 0A → 1)

- **Added** `docs/product/RESPONSEOS_IMPLEMENTATION_PLAN.md` — fine-grained, planning-only decomposition of the front of the canonical phase plan into **Exec 0A** (implementation sequencing), **Exec 0B** (foundational architecture setup), and **Exec 1** (tenant model + event schema + mock voice-gateway skeleton). Includes milestone breakdown, dependency map, MVP scope lock, implementation ordering, issue-ready task decomposition (`EX-*` IDs mapped to backlog epics), acceptance gates, validation workflow, a Codex repo-execution protocol, and risks/blockers/open questions.
- **Indexed** the new doc in `docs/README.md`.
- Planning only — **no production implementation, no live integrations, no deploys.** The arc stops at a mock, deterministic, zero-key state; v0.3 live work remains gated per ADR-0001. Canonical docs and ADR-0011→0018 are unchanged.

## Unreleased — canonical `RESPONSEOS_*` documentation set + go-forward stack

- **Added** 24 canonical docs under `docs/{product,architecture,ops,brand,research}/`, indexed by `docs/product/RESPONSEOS_BUILD_SOURCE.md`. Defines ResponseOS as multi-tenant Revenue Recovery Infrastructure and specifies the go-forward stack: Twilio edge, a dedicated Node.js **voice gateway**, **Grok Voice (primary) / OpenAI Realtime (fallback)**, n8n async orchestration, **HubSpot as CRM system of record**, Redis realtime session state, PostHog + Sentry + Better Stack observability, and Obsidian as the internal SOP/brand-knowledge layer.
- **Added** ADR-0011 → ADR-0018 to `docs/DECISIONS.md` reconciling the new stack with prior decisions. **Superseded** ADR-0008 (Grok was experimental; now primary realtime voice via ADR-0012). New ADRs cover the voice gateway (0013), Redis session state (0014), HubSpot CRM SoR (0015), Obsidian SOP layer (0016), n8n async-only boundary (0017), and the observability stack (0018). Retained disciplines: mock-first, event-ledger-first, signature validation, three compliance lanes, billing-in-v0.5.
- **Updated** `docs/README.md` with an index of the canonical `RESPONSEOS_*` set and the reconciliation note.
- Documentation only — no application code, no live integrations, no deploys. ResponseOS remains not HIPAA-certified.

## Unreleased — docs readiness pass

- **Added** `docs/PRD.md`, `docs/ROADMAP.md`, `docs/DECISIONS.md`, `docs/CHANGELOG.md` — single forward source of truth for product scope, milestones, and architectural decisions.
- **Renamed** `docs/security.md` → `docs/SECURITY.md`; `docs/deployment.md` → `docs/DEPLOYMENT.md`; root `DESIGN.md` → `docs/DESIGN.md`. All product docs now live under `docs/`.
- **Archived** `docs/v0.2-implementation-spec.md`, `docs/v0.2-phase-d-brief.md`, `docs/v0.2-planning-spec.md` to `docs/archive/`. Their implementation has shipped; they remain as historical artifacts and may have stale relative links.
- **Updated** `README.md`, `docs/README.md`, `docs/DEPLOYMENT.md`, `AGENTS.md` to reflect current repo state (13 commits, remote on `audiojones-dev/responseos`, CI live, v0.2 Phase A–D merged).

## v0.2 Phase D — Integration tests + CI hardening

- **`8a8c6a0`** — test: add v0.2 integration suite + CI integration job ([PR #12](https://github.com/audiojones-dev/responseos/pull/12)). Adds `tests/integration/*`, `tests/factories/*`, `vitest.integration.config.ts`, and a second CI job that runs a Postgres 16 service container, `prisma migrate diff`, `prisma migrate deploy`, `prisma db seed`, `npm run test:integration`, and `npm run build` against the seeded DB.
- **`c32ec1c`** — docs: add v0.2 Phase D brief ([PR #11](https://github.com/audiojones-dev/responseos/pull/11)). Implementation brief for the test + CI work above. Archived under `docs/archive/v0.2-phase-d-brief.md`.

## v0.2 Phase C — Route consumers through the v0.2 data layer

- **`c681134`** — feat: route consumers through v0.2 data layer ([PR #7](https://github.com/audiojones-dev/responseos/pull/7)). Admin pages, client portal pages, and API routes now read through `lib/data/*` with tenant scoping enforced at the data layer.

## v0.2 Phase B — Auth + data access

- **`f6cfaf8`** — feat: add v0.2 auth and data access layer ([PR #6](https://github.com/audiojones-dev/responseos/pull/6)). `lib/auth/*` scaffold, `lib/data/*` accessors with `organizationId` filter on every read/write, role-aware access checks for `aj_admin` / `operator` / `client_admin` / `client_viewer`.

## v0.2 Phase A — Schema + deterministic seed

- **`07cb14e`** — feat: add v0.2 schema and deterministic seed ([PR #5](https://github.com/audiojones-dev/responseos/pull/5)). `prisma/schema.prisma` expansion, first migration under `prisma/migrations/0001_v0_2_foundation/`, `prisma/seed.ts` keyed off `lib/mock/*` fixtures for byte-deterministic IDs.

## v0.2 planning + design

- **`386801a`** — docs: add v0.2 DB/Auth/Data Layer implementation spec ([PR #4](https://github.com/audiojones-dev/responseos/pull/4)). Archived under `docs/archive/v0.2-implementation-spec.md`.
- **`2cc4b4c`** — docs: add ResponseOS design system spine ([PR #3](https://github.com/audiojones-dev/responseos/pull/3)). Now `docs/DESIGN.md`.
- **`e362ba8`** — docs: add pricing and onboarding strategy ([PR #2](https://github.com/audiojones-dev/responseos/pull/2)). Now `docs/pricing-and-onboarding.md`.
- **`5cc9027`** — docs: add future knowledge layer roadmap ([PR #1](https://github.com/audiojones-dev/responseos/pull/1)).
- **`761464d`** — ci: add validation workflow. `.github/workflows/ci.yml` with the `validate` job (lint + typecheck + test + build).
- **`b456bd9`** — docs: add Grok Voice provider roadmap.
- **`0646f83`** — docs: add ResponseOS v0.2 planning spec. Archived under `docs/archive/v0.2-planning-spec.md`.

## v0.1 — Initial scaffold

- **`6987c59`** — chore: initialize ResponseOS v0.1 foundation. Next.js 16 App Router, route groups for marketing / admin / client, TypeScript strict, Tailwind v4, Prisma schema stub, 11 typed domain models in `types/`, mock provider adapters in `lib/providers/*`, mock fixtures in `lib/mock/*`, revenue + scoring math, full product + architecture docs under `docs/`.
