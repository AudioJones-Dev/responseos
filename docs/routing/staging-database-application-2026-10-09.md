# Authorized staging database preparation — October 9, 2026

Applied only to Neon `patient-snow-16014934` / `responseos-staging-mock`, branch `br-mute-boat-a6ylen11` (`main` inside staging), database `neondb`, PostgreSQL 18.6, AWS us-west-2. User's PROCEED follows the explicit migration/permission/fixture review package. Main ResponseOS and live-demo projects were excluded. No Render, HubSpot, website or production changes.

## Applied changes

The existing pre-change snapshot `snap-solitary-darkness-a6z6ik41` was verified present, expiring October 16 at 13:15 UTC. Its earlier restore and corrected control-plane incident are recorded in `staging-preparation-2026-10-09.md`.

Applied repository migrations 0017, 0018 and 0019 through the authenticated Neon SQL connector in one atomic transaction, with a transaction advisory lock, 5-second lock timeout, 30-second statement timeout and a precondition requiring exactly 13 completed prior migrations and no unfinished migration. Removed only each file's outer BEGIN/COMMIT to preserve one transaction. Recorded each exact file checksum in `_prisma_migrations` in the same transaction. This was **not** a Prisma CLI invocation; subsequent Prisma migrate status/schema diff remains a gate before deployment.

| Migration | SHA-256 |
| --- | --- |
| 0017_frl_web_intake_receipts | 1fb6a2c91fe28140e7d5c245364f8d87a78f7e2ab7e33dbd1ed50225364b1c75 |
| 0018_frl_mock_delivery_state | 43b83bd7682e707f8ad2afd14b1e85efec0fb35c40042775ee2473878d01aa90 |
| 0019_hosted_routing_delivery | f298dea7886be1f7eea732addb368905e684b86bcc95e56a05d05a90ce9919ad |

Applied the exact statements in `infra/routing/worker-permissions.review.json`: restricted NOLOGIN role, connection limit 4, column grants, Account mutation guard, five-table role-specific RLS, and PUBLIC TEMP revocation. Owner and neon_superuser retain explicit database TEMP privileges. Existing table owners bypass RLS; the worker does not. Inventory showed no other application login role before this change. This is an observed inventory, not proof that no external service uses the owner.

Created `frl_routing_staging_synthetic` as an internal_demo Account. Inserted six schema-validated synthetic fixture intakes and corresponding simulated queued deliveries, one each for residential, builder, architect, commercial, repair and equipment_acquisition. Payloads use example.invalid and synthetic labels. Their canonical SHA-256 and frozen manifest/plan fingerprints were generated from the repository's inquiry schema and routing functions. These are direct database fixtures, **not hosted HTTP intake acceptance**. No mock receipt is counted as a CRM conversion. No production credentials retrieved or stored.

## PostgreSQL 18 permission evidence

Neon initially rejected SET ROLE because its creator membership had SET=false. Temporarily granted SET=true/INHERIT=false to the existing owner for validation. Afterward restored SET=false/INHERIT=false. Role readback confirms NOLOGIN, NOBYPASSRLS, NOCREATEROLE, NOCREATEDB and connection limit 4. Creator ADMIN membership remains; no worker-to-owner membership exists.

Under actual current_user=responseos_routing_worker_test:

- Visible Account is only the synthetic tenant; six test intakes and six simulated deliveries are readable.
- Six negative probes pass: Account mutation, User SELECT, delivery DELETE, CREATE ROLE, ALTER TABLE and CREATE TEMP TABLE are rejected.
- Temporary cross-tenant and preview/hubspot control fixtures are invisible and cannot be updated.
- Account FOR UPDATE, queued delivery claim/fence update, internal queued notification and system audit insertion succeed. Stale-token update affects zero rows.
- Positive mutations and control fixtures execute inside an intentionally rolled-back subtransaction; all six persistent deliveries remain queued with attempt_count=0. No simulated completion is presented as a worker run or provider delivery.

Owner readback still reports User=1 and WebhookEvent=3; neither table was modified. Migration count is now 16. Original staging endpoint was explicitly suspended after verification; final idle state is recorded in the handoff. No persistent worker process or login session was created.

## Remaining release gates

1. Securely establish the restricted runtime LOGIN credential through an approved secret input. NOLOGIN role currently cannot authenticate. No password is in the repository or connector output.
2. Verify actual worker-principal authenticated strict TLS, invalid credential/certificate rejection, Prisma migration status/schema diff, and complete worker behavior against hosted PostgreSQL 18. SET ROLE tests do not prove authenticated connectivity.
3. Back up and restore the new routing fixtures/receipts/checkpoints into an isolated recovery target. The existing snapshot predates these changes and occupies the one manual Free snapshot slot. Do not delete/replace it automatically. No hosted routing-ledger restore success is claimed.
4. Human review of applied grants/RLS and database-wide TEMP impact; operator incident/secret-rotation ownership.
5. Resolve Render workspace billing and the user's hard $10 cap before chargeable creation. No plan upgrade or paid resource creation was performed. Existing Free quota usage/billing remains unverified; do not promise an invoice amount.

Rollback is application stop/credential containment and forward repair, preserving ledger evidence. No destructive down migrations, source overwrite, record deletion, merge or production activation is authorized by this record. PR #210 remains draft.
