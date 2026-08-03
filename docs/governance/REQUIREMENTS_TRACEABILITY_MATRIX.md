# ResponseOS Requirements Traceability Matrix

**Status:** Draft governance baseline. Pending Audio approval.
**Purpose:** Track product, architecture, security, and governance requirements from source intent to docs, code, and validation evidence.

## Status Values

- **Current:** evidence exists and appears aligned.
- **Needs Review:** evidence exists but requires reconciliation.
- **Planned:** requirement is accepted but not implemented.
- **Blocked:** cannot proceed without approval or dependency.
- **Historical:** retained for context only.

## Matrix

| ID | Requirement | Source | Implementation / Evidence | Validation / Acceptance | Status |
|---|---|---|---|---|---|
| REQ-001 | ResponseOS is the AI Revenue Recovery Platform, not an AI receptionist clone. | `docs/PRD.md` | Product copy, marketing/app surfaces | Docs and UI copy avoid receptionist-only framing | Current |
| REQ-002 | No live provider integrations before v0.3 authorization. | `AGENTS.md`, ADR-0001, `docs/ROADMAP.md` | `lib/providers/*` mock-first pattern | PR review confirms mock fallback remains | Current |
| REQ-003 | No real secrets in repo. | `AGENTS.md`, `docs/SECURITY.md`, `.env.example` | Placeholder env docs only | Secret scan and review before merge | Current |
| REQ-004 | No Firebase. | `AGENTS.md`, roadmap acceptance criteria | No approved Firebase integration | Dependency/config review | Current |
| REQ-005 | No production deploys before v0.3 gates clear. | `AGENTS.md`, `docs/ROADMAP.md` | Deployment docs and PR gates | Deployment docs do not imply authorization | Needs Review |
| REQ-006 | Tenant isolation is mandatory. | `AGENTS.md`, `docs/SECURITY.md`, ADR-0005 | Session-derived `accountId` data access pattern | Tests/review for tenant-scoped reads and writes | Needs Review |
| REQ-007 | Webhook signature validation is mandatory before business mutation. | ADR-0009, `AGENTS.md` | Webhook route patterns | Integration/security tests before live provider work | Needs Review |
| REQ-008 | Provider adapters must fall back to mock when env vars are missing. | ADR-0001, `AGENTS.md` | Provider adapter implementations | Unit/integration coverage and manual review | Current |
| REQ-009 | Postgres/Prisma is the relational data layer. | ADR-0003/ADR-0026, `prisma/schema.prisma` | Prisma schema and migrations | `prisma migrate deploy`, integration tests | Current |
| REQ-010 | Clerk is Standard-lane auth. | ADR-0005, roadmap | Auth/session/proxy surfaces | Auth docs and route review | Current |
| REQ-011 | API docs must match actual API routes. | Documentation governance audit | `docs/api-spec.md`, `app/api/**` | Phase 3 API reconciliation | Needs Review |
| REQ-012 | Data docs must match Prisma schema and migrations. | Documentation governance audit | `docs/data-schema.md`, `prisma/**` | Phase 3 data reconciliation | Needs Review |
| REQ-013 | Canonical PRD and roadmap sources must be declared. | Documentation governance audit | `docs/PRD.md`, `docs/product/RESPONSEOS_PRD.md`, `docs/ROADMAP.md`, product roadmap | Audio canonicalization decision | Needs Review |
| REQ-014 | DoR, DoD, and DoS must exist as standalone governance docs. | Documentation governance audit | `docs/governance/DEFINITION_OF_READY.md`, `DEFINITION_OF_DONE.md`, `DEFINITION_OF_STABLE.md` | Audio review and approval | Needs Review |
| REQ-015 | Risk register must exist and be maintained. | Documentation governance audit | `docs/governance/RISK_REGISTER.md` | Updated during major planning/PRs | Needs Review |
| REQ-016 | Worktree plan must exist for branch backlog and dirty-work handling. | Documentation governance audit | `docs/governance/WORKTREE_PLAN.md` | Branch/worktree operations follow plan | Needs Review |
| REQ-017 | Dashboard data should reflect tracked work. | `AGENTS.md`, `dashboard/README.md` | `dashboard/dashboard-data.json` | Dashboard task updated when work maps to board | Needs Review |
| REQ-018 | ResponseOS must not be represented as HIPAA-certified. | `AGENTS.md`, `docs/SECURITY.md`, roadmap | Product/security docs | Copy and docs review | Current |

## Maintenance Rule

Update this matrix when:

- PRD or roadmap scope changes.
- ADRs add or supersede requirements.
- API, data, auth, provider, deployment, or security contracts change.
- Governance docs add new gates.
- Validation evidence changes materially.

