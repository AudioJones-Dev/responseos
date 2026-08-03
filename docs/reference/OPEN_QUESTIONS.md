# ResponseOS Open Questions

**Status:** Draft reference baseline. Pending Audio approval.
**Purpose:** Track unresolved decisions that should not be silently answered inside implementation work.

## Active Open Questions

| ID | Question | Owner | Needed before | Status / notes |
|---|---|---|---|---|
| OQ-001 | Should ResponseOS adopt numbered AJ Digital OS file names or keep current names with a governance index? | Audio | Final canonicalization approval | Open; `DOCUMENTATION_INDEX.md` maps the stack without deciding the naming model |
| OQ-002 | Should future ADRs stay in `docs/DECISIONS.md` or move to `docs/adr/`? | Audio | New ADR structure | Open |
| OQ-003 | Who approves DoR, DoD, and DoS: Audio only, Codex draft plus Audio approval, or CODEOWNERS-backed review? | Audio | Governance docs marked accepted/stable | Open |
| OQ-004 | Is Claude an active build lane or a review/planning-only lane? | Audio | `CLAUDE.md` build-plan remediation | Open |
| OQ-005 | Should active docs state Neon as canonical Standard-lane DB language everywhere, with Supabase historical only? | Audio | Final docs canonicalization | Open; ADR-0026 points to Neon |
| OQ-006 | What concurrency targets define v0.3 provider-readiness for voice? | Audio / engineering | Live provider readiness | Open |
| OQ-007 | Which golden-call harness will be used: custom harness or vendor tooling? | Engineering | Voice/prompt release acceptance | Open |
| OQ-008 | What is the minimum production observability stack for first pilot: Sentry only, Sentry + Better Stack, or full OTel path? | Audio / engineering | Production deploy approval | Open |
| OQ-009 | What exact human-backup transfer capacity exists for early pilots? | Audio / operations | Live voice recovery | Open |
| OQ-010 | What are the initial retention windows for call recordings, transcripts, audit logs, and incident evidence? | Audio / security | Privacy-hardened or production tenant | Open |

## Maintenance Rule

Add a row when a decision blocks implementation, merge readiness, stability, production readiness, or provider authorization. Close a row only by referencing the accepted decision, PR, ADR, or governance doc that resolved it.
