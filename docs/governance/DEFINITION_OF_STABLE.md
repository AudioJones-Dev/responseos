# Definition of Stable

**Status:** Draft governance baseline. Pending Audio approval.
**Purpose:** Define when ResponseOS docs, features, or operational surfaces are stable enough for dependent work.

## Stable Means

A surface is stable when it has shipped or been accepted, is documented as current, has passing validation evidence, and has no known unresolved blocker that would mislead future work.

Stable is stronger than done. A work item can be done for review but not stable for dependency.

## Stability Checklist

A surface is stable when:

- The source of truth is declared.
- Conflicting or superseded docs are marked.
- Acceptance criteria are met.
- Required validation is green or exceptions are approved.
- Risks are recorded in `RISK_REGISTER.md`.
- Open questions are either closed or tracked in the approved open questions register.
- Owner and maintenance path are clear.
- Rollback or recovery path exists when applicable.
- No production, provider, secret, or tenant-safety gate is bypassed.

## Documentation Stability

A documentation surface is stable when:

- It has a status label.
- It points to upstream canonical sources.
- It does not contradict `AGENTS.md`, accepted ADRs, PRD, or roadmap.
- It has been reconciled against actual repo files when it describes code, API, schema, deployment, or validation.
- Historical material is labeled historical or archived.

## Product / Feature Stability

A product or feature surface is stable when:

- It maps to roadmap scope.
- It has user-facing or operator-facing acceptance criteria.
- Data and API contracts are documented.
- Tenant isolation is verified where tenant data is involved.
- Mock fallback remains available for provider-dependent behavior unless live integration has explicit approval.

## Operational Stability

An operational surface is stable when:

- Runbook or recovery instructions exist.
- Deployment or environment assumptions are current.
- Required secrets are documented as placeholders only.
- Observability and failure modes are defined for production-intended behavior.
- Production readiness is not implied before v0.3 authorization.

## Stability States

Use these labels when useful:

- **Draft:** proposed, not approved.
- **Accepted:** approved for current work.
- **Stable:** accepted, validated, and safe for dependent work.
- **Historical:** retained for context, not current guidance.
- **Superseded:** replaced by a named newer source.

