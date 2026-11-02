# Production database: migrations 0009–0013 and the internal-demo receptionist

Status: **executed 2026-11-02, verified.** This is the public record. Provider identifiers, the production target's location, connection handling and evidence live in the operator's private evidence folder (`responseos-evidence/prod-migration-status-20261102/`), not in this repository.

## Problem

- **Demo outage.** `/demo/receptionist` on responseos.pro logged `agent profile read failed (P2021)` from at least 2026-10-26. P2021 is Prisma's "table does not exist". The page failed closed by design (ADR-0052) and told visitors it was "not answering".
- **Cause.** The production database had applied migrations `0001`–`0008` only. `AgentProfile` comes from `0009`.
- **Same gap for intake.** `ProspectIntake`, which `/audit` intake writes to, comes from `0011`. Turning intake on would have failed the same way.

## Pre-checks (read-only)

| Check | Result |
|---|---|
| Production target identified | By correlating live page requests with database compute activity (three times), then confirming the production deployment and its database variables were unchanged |
| Applied history | `0001`–`0008`, all finished; `npm run database:evidence -- history` returned `ok: true` (an ordered prefix of master, checksums equal) |
| `0009`–`0013` content | Additive only: new tables, new enum values, a defaulted column. `0013`'s single `UPDATE` targets a table created in `0012` |
| Data needed by the page | The migrations insert no rows. The page reads only `AgentProfile`; knowledge comes from code fixtures. The internal-demo account did not exist |

The read-only check procedure is [`production-migration-status-check.md`](./production-migration-status-check.md).

## Change

1. **Restore point.** A database snapshot was taken before any write.
2. **Rehearsal.** The full change ran first on a copy of production's data:
   - migrations applied cleanly and a re-run inserted nothing new
   - history `ok`
   - local `next dev` against the copy answered `/demo/receptionist`
3. **Migrations.** `prisma migrate deploy` applied `0009`–`0013`. Prisma ran through a wrapper that refused any host but the intended target and redacted credentials from output.
4. **Data.** The SQL below was extracted verbatim from this file and run in one transaction, committing only if the check returned `org_tyrone_1 | internal_demo | 4 | 4 | 1`. The full `prisma db seed` was deliberately not run, because it would add customer-style demo data to production.

```sql
INSERT INTO "Account" (id, name, slug, industry, website_url, primary_phone, timezone, status, account_type, created_at, updated_at)
VALUES ('org_tyrone_1', 'Tyrone Nelms', 'tyrone-nelms', 'professional-services', 'https://tyronenelms.com', '+15555550700', 'America/New_York', 'active', 'internal_demo', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO "AgentProfile" (id, account_id, name, slug, type, enabled, is_default, system_policy_json, metadata_json, created_at, updated_at) VALUES
('agent_tyrone_consulting',   'org_tyrone_1', 'Consulting Receptionist', 'consulting-receptionist', 'consulting_receptionist', true, false,
 '{"allowedAppointmentTypes":["consulting_discovery"],"allowedAssetTypes":["portfolio","case_study"],"compensationDisclosure":"escalate","referencesDisclosure":"escalate","knowledgeFallback":"verified_only"}',
 '{"description":"Qualifies consulting and advisory inquiries, captures the operational problem, and routes discovery calls."}',
 '2026-08-03T12:00:00Z', '2026-08-03T12:00:00Z'),
('agent_tyrone_demo',         'org_tyrone_1', 'Demo Mode', 'demo-mode', 'demo_mode', true, false,
 '{"allowedAppointmentTypes":["demo"],"allowedAssetTypes":[],"compensationDisclosure":"escalate","referencesDisclosure":"escalate","knowledgeFallback":"verified_only"}',
 '{"description":"Narrates the ResponseOS workflow being exercised during a live demonstration while staying grounded in this account''s real records."}',
 '2026-08-03T12:00:00Z', '2026-08-03T12:00:00Z'),
('agent_tyrone_professional', 'org_tyrone_1', 'Professional Assistant', 'professional-assistant', 'professional_assistant', true, false,
 '{"allowedAppointmentTypes":["professional_intro"],"allowedAssetTypes":["portfolio","linkedin"],"compensationDisclosure":"escalate","referencesDisclosure":"escalate","knowledgeFallback":"verified_only"}',
 '{"description":"General professional front door — who Tyrone is, what he works on, and how to reach him."}',
 '2026-08-03T12:00:00Z', '2026-08-03T12:00:00Z'),
('agent_tyrone_recruiter',    'org_tyrone_1', 'Recruiter Receptionist', 'recruiter-receptionist', 'recruiter_receptionist', true, true,
 '{"allowedAppointmentTypes":["recruiter_screen","hiring_manager_interview"],"allowedAssetTypes":["resume","portfolio","linkedin","github","email"],"compensationDisclosure":"escalate","referencesDisclosure":"escalate","knowledgeFallback":"verified_only"}',
 '{"description":"Answers verified questions about Tyrone Nelms'' professional experience, projects and capabilities, captures recruiting opportunities, and helps schedule interviews."}',
 '2026-08-03T12:00:00Z', '2026-08-03T12:00:00Z')
ON CONFLICT (id) DO NOTHING;

SELECT a.id, a.account_type, count(p.id) AS profiles, count(*) FILTER (WHERE p.enabled) AS enabled, count(*) FILTER (WHERE p.is_default) AS defaults
FROM "Account" a LEFT JOIN "AgentProfile" p ON p.account_id = a.id
WHERE a.id = 'org_tyrone_1' GROUP BY a.id, a.account_type;
```

Values are copied from `prisma/seed.ts` (`seedAccounts`, `seedAgentProfiles`), with apostrophes doubled for SQL.

## Verification (2026-11-02, after the change)

| Check | Result |
|---|---|
| `/demo/receptionist` contains "not answering" | No (charter signal M2 = 0) |
| "What projects has Tyrone worked on?" | Answered from a verified record |
| A compensation question | Owner follow-up required, the escalation its policy specifies |
| Production runtime warnings and errors after the change | None |
| `/api/health` `build_sha` | Unchanged (`6f579cc`): no deployment was involved |
| Migration history | 13 migrations, last `0013`, `database:evidence history` `ok: true` |

## Scope held

- **Not done:** no deployment, no environment variable change, no role or grant change, no provider credential, and the FRL pilot migrations were not applied. ADR-0053's mock-adapter carve-out is unchanged.
- **Intake still gated:** `/audit` intake remains off. Its table now exists, so turning it on depends only on the WAF evidence (J-05) and the intake account decision.

## Follow-ups

- **Snapshot cleanup:** delete the pre-change snapshot after its retention window, and the rehearsal copy now. Each is a separately approved operator action.
- **Gap register:** record D2 as closed and J-05 as unblocked on the schema side (`RESPONSEOS_RELEASE_BASELINE_GAP_REGISTER_2026-10-31.md`, in #234).
- **Database runtime role:** review it under A-DB (ADR-0070).
