# Inactive client setup — review and execution plan

Status: local implementation for review. The operator supplied production mapping on October 29; see the [local release preparation](../release/frl-inactive-20261029/README.md). Mapping is context only and was not queried during that preparation. No hosted migration, account write, deployment, invitation, access grant or provider action is authorized.

## Behavior

Operators can create an inactive account and edit its setup draft at `/admin/clients/new` and `/admin/clients/:id/setup`. Customer roles can only read their session's account at `/client/setup`; they cannot create, edit, approve or publish a draft. A founder is descriptive business information, not a User, owner membership or Clerk organization.

Account creation requires business name, unique slug, industry, valid IANA timezone, founder name and E.164 business contact number. The account is `customer` / `paused`. A name match (case/punctuation/ampersand normalized), slug match, or matching legacy/draft contact number refuses creation and asks for reconciliation. This is conservative duplicate detection, not entity resolution. An operator must resolve near matches and business aliases before any future production execution. The creation API does not accept a requested account ID or silently reuse an account.

All seven setup capabilities remain false: recording, transcription, AI answering, forwarding, outbound calls, automated follow-up and automatic memory ingestion. A draft is never a runtime policy. There is no approval, publication or activation endpoint in this workflow. The UI describes setup state, not external provider state.

Contact numbers stay in the draft with ownership/routing verification pending and `provisioned:false`. No `TelephonyNumber`, `TelephonyNumberAssignment`, `ProviderConnection`, `User`, `AgentProfile`, `KnowledgeFact`, `BusinessMemorySnapshot`, call or notification is created. No `Account.primary_phone` is set by setup; legacy integrations must not mistake an unverified contact for a routing destination.

Draft business facts and disclosure text/purpose/consent/refusal proposals may be empty while setup is incomplete. They remain visibly pending. A later separately approved publication flow must validate completeness, purpose, consent/refusal handling and runtime gates; this slice supplies no such flow. Approved pilot memory is not used as draft input automatically.

## Storage decision

Reuse `Account` for identity, existing tenant/role helpers, and `AuditLog` for revision-only mutation evidence. Add one nullable `Account.setup_draft_json` JSONB column, validated by `inactive-client-setup.v1`. It stores founder name, unverified contact number, draft facts, draft disclosure/flows, revision and fixed inactive markers. Account status already supports `paused`; no enum or provider model change is needed.

Existing `AgentProfile.system_policy_json` is runtime policy, so it is unsuitable for unpublished setup. Existing `BusinessMemorySnapshot` is an executable knowledge snapshot with an approval lifecycle and required template/hash semantics, not an account profile draft. Using either risks accidental publication. This isolated nullable field is the smallest explicit boundary. Existing rows remain null; no backfill or pilot changes.

`20261028_inactive_client_setup/migration.sql` is **review-only for hosted environments**. It adds only the nullable column. Local testing may apply it solely to a newly created disposable localhost database. Do not apply the master migration chain to the pilot: its 0014–0028 lineage differs from master.

## API

- `POST /api/admin/client-setups`: operator only, strict create input; 201 or 409 duplicate refusal.
- `PATCH /api/admin/client-setups/:id`: operator only, `{revision, draft}`; edits only a setup-owned paused account. 409 for stale revision, legacy account, or changed lifecycle. Identity and access cannot be edited here.
- `GET /api/client/setup`: existing session-derived tenant; no client-selected account parameter.
- All mutation services require `RESPONSEOS_LOCAL_CLIENT_SETUP=1`, non-production, no Vercel environment, and a loopback PostgreSQL URL for `responseos_inactive_setup_test` (or `responseos_test` only under NODE_ENV=test for existing CI). No production override exists.
- Transactions serialize setup writers, check collisions and write revision-only audit rows atomically. No private draft content is copied to audit metadata. No write succeeds without an explicit local database; no-DB mode is read-only synthetic preview.

## Synthetic demonstration

With no DATABASE_URL, DIRECT_URL, provider credentials or Clerk configuration:

1. Run `npm run dev -- --hostname 127.0.0.1 --port 3100` with `RESPONSEOS_DEV_SESSION=aj_admin`.
2. Open `/admin/clients/org_mock_1/setup`: synthetic Sunshine HVAC / Taylor Example / +12025550123; draft editing displayed but saving disabled.
3. Stop the operator dev process, then restart with `RESPONSEOS_DEV_SESSION=client_admin@org_mock_1` (or `client_viewer@org_mock_1`). Open `/client/setup`. Same synthetic business; read-only, no editing or activation controls. A client request for another account is denied by the accessor.
4. For persisted creation/editing, use only the dedicated disposable test database, apply the reviewed migration there, and set the local flag. Use fictional business details; never FRL's durable ID, real number or pilot records in tests.

## Production execution plan — BLOCKED

1. Preserve the operator-supplied October 29 mapping recorded in the [release preparation](../release/frl-inactive-20261029/README.md). Fresh target/schema/history readback still needs separate authorization. No database is selected by name and mapping is not connection approval.
2. Inventory actual migration history/checksums and Account schema. Read-only search for matching name/slug/contact and customer ID `<operator-supplied candidate ID>`. Reconcile any existing production identity rather than forcing that ID. Keep `<operator-supplied demo ID>` separate.
3. Review the additive schema diff against that exact destination, an isolated rehearsal, least-privilege runtime access, tenant tests and recovery evidence. Authorize the exact migration separately. This implementation's hosted-write block remains in place; an approved execution mechanism is a separate change.
4. Proposed account configuration only after confirmation: Florida Ramp & Lift; founder <operator-supplied founder>; unverified/unprovisioned <operator-supplied number>; paused setup; no access binding. Preserve the candidate durable ID only if collision-free and appropriate. New-account API deliberately cannot force/import that ID; identity-preserving production reconciliation needs a reviewed exact-ID transaction.
5. Proposed opening disclosure stays draft: “Thank you for calling Florida Ramp & Lift. With your permission, we’d like to record and transcribe this call for service documentation, quality assurance and training.” Purpose and consent/refusal handling require separate factual/policy approval. No capture is authorized by storing this wording.
6. Do not import the three pilot calls, approved memory snapshot or old number assignments. Before any later migration, inventory source IDs, provider/event evidence, timestamps, consent, retention/erasure state, source ownership, snapshot approval provenance and target relevance. Approved-in-pilot does not mean approved-in-production. Preserve source history and require a separate scoped decision for each data category.
7. Review exact writes: at most one reconciled Account identity and its draft field, plus audit evidence. Zero writes to users, memberships, provider inventory, assignments, active profiles, knowledge snapshots or caller evidence. Confirm all external feature gates separately; setup booleans cannot prove provider-side state.

## Rollback and acceptance

Use a transaction and revision precondition; any error rolls back the account/draft and its audit event together. Capture existing row/version before an approved future update. Undo only that draft revision after verifying no intervening changes. Delete a newly created account only if separately approved and unreferenced; otherwise keep it paused and record reconciliation. Leave the nullable column in place on application rollback; no destructive down migration or pilot restore. Test failure of the audit insert to prove atomic rollback.

Required validation: lint, typecheck, full unit tests, credential-free build and PostgreSQL 16 integration suite. Integration cases cover duplicate/refused/racing creation, required fields, tenant roles, immutable inactive flags, draft publication rejection, no provider/access side effects, revisions, and blocked production/remote writes. Browser demonstration uses test identities only. Production collision/schema checks, migration rehearsal for the verified target, CI and human review remain separate from local success.

## Doctrine §21 review

1. Layer: tenant configuration and trust infrastructure.
2. Build a small draft workflow over existing models; no provider integration.
3. Improves pilot preparation without activating it.
4. Preserves source history and records revision-only audit evidence.
5. Makes no verified-outcome claim.
6. No proprietary learning or automatic ingestion.
7. Reuses Clerk for eventual access; no identity platform is built.
8. Does not duplicate CRM, carrier, FSM or workflow execution.
9. No new vendor dependency.
10. Existing session-derived tenant scope; cross-tenant writes operator-only.
11. Duplicate refusal and separate demo identity reduce attribution ambiguity.
12. UI says draft, inactive and unverified; no operational claim.
13. Future publication, access, destination and activation approvals remain separate.
14. Only minimum business contact data; no email, caller evidence or credentials.
15. Required for the requested account setup; ingestion, ownership and telephony are deferred.

## Local validation evidence — 2026-10-28

Base: current master `46eb2150db677a66d49a6ab09e01534efa210278`; branch `codex/inactive-client-setup`.

- Lint and TypeScript: passed.
- Full unit suite: 63 files, 776 tests passed (21 setup tests).
- Full integration suite: 15 files, 183 tests passed (14 setup tests).
- Credential-free build and final disposable-database-backed build: passed.
- All 14 migrations applied only to disposable PostgreSQL 16.14 on 127.0.0.1:55438, database responseos_inactive_setup_test, role setup_test. Schema diff: no difference. No hosted database used.
- Browser: synthetic operator created Harbor Test Access, then saved a draft fact at revision 2. UI returned 201 for creation and 200 for draft update. Synthetic customer preview was read-only; operator setup route denied customer access. All seven capabilities displayed Off; contact remained unverified/unprovisioned.
- Runtime was Node 24.21.0 / npm 11.19.0 rather than pinned 24.18.0 / 11.16.0. CI with pinned versions remains pending. Local build warned about missing public canonical URL; browser extension injected kapture-loaded and caused a development hydration warning.
- Self-review completed; independent human review and CI have not occurred. No push, deployment, real account, production migration, pilot import, invitation, provider setting or support request.

Production execution remains blocked. This local implementation deliberately has no hosted-write override; approval of a verified destination must precede a separately reviewed production execution mechanism.

## Independent review follow-up — 2026-10-28

Baseline d131ffb94d58e662c9e5005ebcd96b7710c5a1a1 was independently inspected by a separate read-only reviewer before fixes.

- **P1 fixed:** false draft flags did not enforce runtime inactivity. Legacy signed Telnyx mapping could capture a paused setup account's transcript. The new accountRuntimeAllowed guard denies missing accounts, paused accounts and any non-null setup JSON, including malformed drafts. It applies before raw call-payload capture, direct normalization, assistant context compilation, CRM work and website memory ingestion. A missing draft on a paused account still denies. Draft data cannot grant permission.
- **P3 fixed:** rendered setup sections skipped H1 to H3. Both setup components now use H2 without changing shared components.
- Independent re-review found no remaining confirmed blocker in runtime/tests/heading changes. Operator/session authorization, strict unknown-field rejection, serializable duplicate refusal, contact separation and published configuration preservation were checked.

Pinned tools: Node 24.18.0 (official archive SHA256 verified), npm 11.16.0, Next 16.4.3, Prisma 6.19.3, Vitest 4.1.11, PostgreSQL 16.14. Final lint/typecheck passed; full unit suite 777 passed; full integration suite 190 passed, then expanded setup suite 21 passed including an additional operator/no-session/role-injection test. Credential-free and disposable-database builds passed. Local schema diff: no difference. An initial unit run inherited REQUIRE_AUTH=1 and disabled test sessions; corrected test environment passed. An initial local database connection used the old port; corrected loopback identity readback preceded passing integration tests.

Runtime evidence: AI business context withheld; call transcript/recording payload normalization denied; CRM follow-up denied; memory ingestion makes no fetch/write. Live record-start, outbound calling and forwarding implementations do not exist in the current carrier/voice mocks; none added. Local tests do not establish external provider state. Unavailable assistant initialization may still retain an unassigned initialization event in the existing ledger; this is not a claim of zero webhook metadata storage.

Browser: synthetic customer viewer is read-only and denied operator setup. Synthetic operator creation and edits survive full reload; a stale second tab is refused and reload shows the latest revision. Labels/status feedback and corrected heading levels were checked. Browser extension kapture-loaded causes a development hydration warning. This is an accessibility smoke check, not an exhaustive assistive-technology audit.

The exact migration ran on a populated transaction-local table: existing values unchanged, new field null, saved JSON retained through old-column reads. This proves additive/data preservation, not full deployment rollback. Keep the column and draft records on rollback. Before reverting the runtime guard in a future hosted release, separately approve a containment plan stopping relevant capture/automation entrypoints; old code does not enforce the new deny marker. No hosted rollback was executed.

CI, branch publication authorization, verified production mapping and target-specific migration/rollback rehearsal remain outstanding. No push, deployment, provider change, production migration, real account, invitation or pilot-history change occurred.
