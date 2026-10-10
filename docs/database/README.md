# Neon standardization handoff — 2026-10-09

Status: discovery and safe repository implementation; hosted configuration, migration and cutover are **NOT AUTHORIZED**. Neon is the selected relational platform under ADR-0026. The authoritative **dataset and deployed connection** must be identified per environment; a project name is not proof of data ownership.

Deliverables:

1. [Dependency inventory](inventory.md) and [redacted provider evidence](readback-2026-10-09.json).
2. [Architecture, costs and recovery targets](architecture.md), proposed ADR-0070 in [DECISIONS](../DECISIONS.md).
3. [Migration manifest and preservation mapping](migration-manifest.json).
4. [Schema, role and RLS comparison](security-impact.md).
5. [Validation and reconciliation evidence](validation.md).
6. [Cutover, restore safety, rollback and outstanding approvals](runbook.md).

Critical findings: staging has a Clerk-linked operator and cannot be reset; live-demo has an applied `0017_call_control_qualification` that differs from the FRL stack's `0017_frl_web_intake_receipts`; the primary project's default branch has no public application tables but has `neon_auth` tables; application RLS is absent in inspected branches; actual deployed sensitive connection values are unavailable through the connector. The migration conflict is a lineage discrepancy, not proof that PostgreSQL disallows two differently named migration directories with the same numeric prefix.

**NO PROVIDER DATA MIGRATION REQUIRED** for the repository dependencies confirmed in this audit: neither repository uses Supabase database APIs, Auth, Storage, Realtime or Edge Functions. This conclusion is bounded by the unresolved deployment/Render inventory and unknown owners of extra schemas. It is not permission to remove a Supabase resource or a claim that every account-wide resource was inspected.

Repository changes deliberately do not import PR #209/#210, renumber applied migrations, change adapters or alter any hosted connection. Their routing acceptance remains independently reviewable.
