import { readFileSync } from "node:fs";
import { Prisma } from "@prisma/client";
import { accountRuntimeAllowed } from "@/lib/clientSetup/runtime";
import { recordCallTranscript } from "@/lib/data/callTranscripts";
import { recordCallSegment } from "@/lib/data/callSegments";
import { createManualKnowledgeFact, createAndApproveMemorySnapshot } from "@/lib/prospectBootstrap/service";
import { normalizeTelnyxEvent } from "@/lib/providers/telnyx/normalize";
import { runCrmSyncForCall } from "@/lib/crm/syncFinalizedCall";
import { afterAll, afterEach, beforeEach, describe, expect, test } from "vitest";
import { createClientSetup, readClientSetup, updateClientSetup } from "@/lib/clientSetup/service";
import { buildSetupDraft, DraftInputSchema } from "@/lib/clientSetup/contracts";
import { SYNTHETIC_SETUP_INPUT } from "@/lib/clientSetup/fixture";
import { POST } from "@/app/api/admin/client-setups/route";
import { PATCH } from "@/app/api/admin/client-setups/[id]/route";
import { GET } from "@/app/api/client/setup/route";
import { disconnectTestDb, prisma, resetTestDb, setDevSession } from "./setup";

const fresh = { ...SYNTHETIC_SETUP_INPUT, businessName: "Bluebird Plumbing", slug: "bluebird-plumbing", contactNumber: "+12025550124" };
const draftInput = DraftInputSchema.parse({ founderName: SYNTHETIC_SETUP_INPUT.founderName, contactNumber: SYNTHETIC_SETUP_INPUT.contactNumber, facts: SYNTHETIC_SETUP_INPUT.facts, disclosure: SYNTHETIC_SETUP_INPUT.disclosure });
const oldFlag = process.env.RESPONSEOS_LOCAL_CLIENT_SETUP;

beforeEach(async () => {
  const url = new URL(process.env.DATABASE_URL!);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || !["/responseos_test", "/responseos_inactive_setup_test"].includes(url.pathname)) throw new Error("Dedicated localhost test database required");
  await resetTestDb();
  setDevSession("aj_admin");
  process.env.RESPONSEOS_LOCAL_CLIENT_SETUP = "1";
  await prisma.account.create({ data: { id: "org_mock_1", name: SYNTHETIC_SETUP_INPUT.businessName, slug: SYNTHETIC_SETUP_INPUT.slug, industry: "hvac", timezone: "America/New_York", status: "paused", setup_draft_json: buildSetupDraft(draftInput, 1) } });
  await prisma.account.create({ data: { id: "org_mock_2", name: "Other Synthetic Business", slug: "other-synthetic", industry: "hvac", timezone: "America/New_York", status: "paused", setup_draft_json: buildSetupDraft({ ...draftInput, founderName: "Other Example", contactNumber: "+12025550125" }, 1) } });
});
afterEach(() => { if (oldFlag === undefined) delete process.env.RESPONSEOS_LOCAL_CLIENT_SETUP; else process.env.RESPONSEOS_LOCAL_CLIENT_SETUP = oldFlag; });
afterAll(disconnectTestDb);

describe("inactive setup transaction and authorization", () => {
  test("operator creates only an inactive account and audit evidence", async () => {
    const response = await POST(new Request("http://localhost/api/admin/client-setups", { method: "POST", body: JSON.stringify(fresh) }));
    expect(response.status).toBe(201);
    const { data } = await response.json();
    expect(data.account.status).toBe("paused");
    expect(Object.values(data.draft.capabilities)).toEqual(Array(7).fill(false));
    const row = await prisma.account.findUniqueOrThrow({ where: { id: data.account.id } });
    expect(row.primary_phone).toBeNull(); expect(row.clerk_org_id).toBeNull();
    expect(await prisma.auditLog.count({ where: { account_id: row.id, action: "client_setup.created" } })).toBe(1);
    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.agentProfile.count()).toBe(0);
    expect(await prisma.telephonyNumber.count()).toBe(0);
    expect(await prisma.telephonyNumberAssignment.count()).toBe(0);
    expect(await prisma.businessMemorySnapshot.count()).toBe(0);
    expect(await prisma.knowledgeFact.count()).toBe(0);
    expect(await prisma.providerConnection.count()).toBe(0);
    expect(await prisma.automation.count()).toBe(0);
    expect(await prisma.call.count()).toBe(0);
  });
  test.each([
    { businessName: " SUNSHINE hvac ", slug: "different-slug" },
    { slug: "sunshine-hvac" },
    { contactNumber: "+12025550123" },
  ])("refuses duplicates without mutating existing identity: %j", async (changes) => {
    expect(await createClientSetup({ ...fresh, ...changes })).toMatchObject({ ok: false, error: { code: "duplicate_account" } });
    expect(await prisma.account.count()).toBe(2); expect(await prisma.auditLog.count()).toBe(0);
  });
  test("refuses contact collisions with legacy accounts", async () => {
    await prisma.account.update({ where: { id: "org_mock_2" }, data: { primary_phone: "+1 (202) 555-0124" } });
    expect(await createClientSetup(fresh)).toMatchObject({ ok: false, error: { code: "duplicate_account" } });
  });
  test("concurrent duplicate requests create at most one account", async () => {
    const results = await Promise.all([createClientSetup(fresh), createClientSetup({ ...fresh, slug: "bluebird-other" })]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(await prisma.account.count({ where: { name: fresh.businessName } })).toBe(1);
  });
  test("malformed drafts still reserve their contact number on create and edit", async () => {
    await prisma.account.update({ where: { id: "org_mock_2" }, data: { setup_draft_json: { contactNumber: "+1 (202) 555-0124" } } });
    expect(await createClientSetup(fresh)).toMatchObject({ ok: false, error: { code: "duplicate_account" } });
    expect(await updateClientSetup("org_mock_1", { revision: 1, draft: { ...draftInput, contactNumber: fresh.contactNumber } })).toMatchObject({ ok: false, error: { code: "duplicate_account" } });
    expect(await prisma.auditLog.count()).toBe(0);
  });
  test("provider inventory including released numbers requires reconciliation", async () => {
    await prisma.telephonyNumber.create({ data: { provider: "synthetic", provider_number_id: "synthetic-reserved", e164: fresh.contactNumber, status: "released" } });
    expect(await createClientSetup(fresh)).toMatchObject({ ok: false, error: { code: "duplicate_account" } });
    expect(await updateClientSetup("org_mock_1", { revision: 1, draft: { ...draftInput, contactNumber: fresh.contactNumber } })).toMatchObject({ ok: false, error: { code: "duplicate_account" } });
    expect(await prisma.auditLog.count()).toBe(0);
  });
  test.each([
    { label: "national-format inventory", seed: () => prisma.telephonyNumber.create({ data: { provider: "synthetic", provider_number_id: "synthetic-national", e164: "(202) 555-0124", status: "released" } }) },
    { label: "contact history", seed: () => prisma.contact.create({ data: { account_id: "org_mock_2", phone: "202.555.0124", source: "call" } }) },
    { label: "user phone", seed: () => prisma.user.create({ data: { id: "synthetic-user", role: "operator", name: "Synthetic", email: "synthetic@example.invalid", phone: "1-202-555-0124" } }) },
  ])("$label is refused on create and edit", async ({ seed }) => {
    await seed();
    expect(await createClientSetup(fresh)).toMatchObject({ ok: false, error: { code: "duplicate_account" } });
    expect(await updateClientSetup("org_mock_1", { revision: 1, draft: { ...draftInput, contactNumber: fresh.contactNumber } })).toMatchObject({ ok: false, error: { code: "duplicate_account" } });
    expect(await prisma.account.count()).toBe(2); expect(await prisma.auditLog.count()).toBe(0);
  });
  test("an unrelated number in history does not block creation", async () => {
    await prisma.contact.create({ data: { account_id: "org_mock_2", phone: "+1 (202) 555-0999", source: "call" } });
    expect(await createClientSetup(fresh)).toMatchObject({ ok: true });
  });
  test.each(["client_admin@org_mock_1", "client_viewer@org_mock_1"])("%s sees own setup only and cannot write", async (role) => {
    setDevSession(role);
    expect(await readClientSetup()).toMatchObject({ ok: true, data: { account: { id: "org_mock_1" } } });
    expect(await readClientSetup("org_mock_2")).toMatchObject({ ok: false, error: { code: "tenant_scope_denied" } });
    expect(await createClientSetup(fresh)).toMatchObject({ ok: false, error: { code: "role_denied" } });
    expect(await updateClientSetup("org_mock_1", { revision: 1, draft: draftInput })).toMatchObject({ ok: false, error: { code: "role_denied" } });
    const response = await GET(); expect(response.status).toBe(200);
    expect((await response.json()).data.account.id).toBe("org_mock_1");
  });
  test("required fields, extra approval fields and malformed requests write nothing", async () => {
    for (const field of ["businessName", "founderName", "contactNumber", "industry", "timezone", "slug"]) {
      expect(await createClientSetup({ ...fresh, [field]: "" })).toMatchObject({ ok: false, error: { code: "validation_failed" } });
    }
    expect(await createClientSetup({ ...fresh, status: "active" })).toMatchObject({ ok: false });
    expect((await POST(new Request("http://localhost", { method: "POST", body: "{" }))).status).toBe(400);
    expect(await prisma.account.count()).toBe(2);
  });
  test("draft edits remain unpublished and stale revision cannot overwrite", async () => {
    const changed = { ...draftInput, facts: [{ label: "Hours", value: "Draft weekdays" }], disclosure: { ...draftInput.disclosure, text: "Record and transcribe only with permission for service documentation." } };
    const result = await updateClientSetup("org_mock_1", { revision: 1, draft: changed });
    expect(result).toMatchObject({ ok: true, data: { draft: { revision: 2, status: "draft", consentApproval: "pending", receptionistPublication: "not_published" } } });
    expect(await updateClientSetup("org_mock_1", { revision: 1, draft: draftInput })).toMatchObject({ ok: false, error: { code: "setup_conflict" } });
    const response = await PATCH(new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ revision: 2, draft: { ...changed, approved: true } }) }), { params: Promise.resolve({ id: "org_mock_1" }) });
    expect(response.status).toBe(422);
    expect(await prisma.businessMemorySnapshot.count()).toBe(0); expect(await prisma.agentProfile.count()).toBe(0);
    expect(await prisma.auditLog.count()).toBe(1);
  });
  test("legacy or active accounts cannot be repurposed by draft editing", async () => {
    await prisma.account.update({ where: { id: "org_mock_1" }, data: { status: "active" } });
    expect(await updateClientSetup("org_mock_1", { revision: 1, draft: draftInput })).toMatchObject({ ok: false, error: { code: "setup_conflict" } });
    expect(await readClientSetup("org_mock_1")).toMatchObject({ ok: false });
  });
  test("writes remain blocked without local opt-in", async () => {
    delete process.env.RESPONSEOS_LOCAL_CLIENT_SETUP;
    expect(await createClientSetup(fresh)).toMatchObject({ ok: false, error: { code: "setup_write_blocked" } });
    expect(await updateClientSetup("org_mock_1", { revision: 1, draft: draftInput })).toMatchObject({ ok: false, error: { code: "setup_write_blocked" } });
    expect(await prisma.account.count()).toBe(2);
  });
  test("draft editing cannot introduce another account's contact number", async () => {
    expect(await updateClientSetup("org_mock_1", { revision: 1, draft: { ...draftInput, contactNumber: "+12025550125" } })).toMatchObject({ ok: false, error: { code: "duplicate_account" } });
    expect(await prisma.auditLog.count()).toBe(0);
  });
  test("audit failure rolls back the new account atomically", async () => {
    await prisma.$executeRawUnsafe(`CREATE FUNCTION setup_test_reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic audit failure'; END; $$`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER setup_test_reject_audit BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION setup_test_reject_audit()`);
    try {
      expect(await createClientSetup(fresh)).toMatchObject({ ok: false, error: { code: "internal_error" } });
      expect(await prisma.account.count({ where: { slug: fresh.slug } })).toBe(0);
      expect(await prisma.auditLog.count()).toBe(0);
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER setup_test_reject_audit ON "AuditLog"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION setup_test_reject_audit()`);
    }
  });
});

 test.each(["valid", "missing", "malformed"])("%s setup draft cannot permit runtime capture or automation", async (kind) => {
   if (kind !== "valid") await prisma.account.update({ where: { id: "org_mock_1" }, data: { setup_draft_json: kind === "missing" ? Prisma.DbNull : { recording: true } } });
   expect(await accountRuntimeAllowed("org_mock_1")).toBe(false);
   expect(await accountRuntimeAllowed("missing-account")).toBe(false);
   expect(await normalizeTelnyxEvent({ accountId: "org_mock_1", demoNumber: "+12025550123", webhookEventId: "no-ledger", event: { data: { id: "synthetic", event_type: "call.conversation_insights.generated", payload: { call_control_id: "synthetic", transcript: "Must not persist" } } } })).toEqual({ callId: null, finalized: false });
   expect(await runCrmSyncForCall({ accountId: "org_mock_1", callId: "no-call" })).toMatchObject({ ok: false, error: { code: "account_inactive" } });
   expect(await recordCallTranscript({ account_id: "org_mock_1", call_id: "no-call", inline_text: "Must not persist" })).toMatchObject({ ok: false, error: { code: "account_inactive" } });
   expect(await recordCallSegment({ account_id: "org_mock_1", call_id: "no-call", sequence: 1, speaker: "caller", text: "Must not persist", started_at: new Date(), ended_at: new Date() })).toMatchObject({ ok: false, error: { code: "account_inactive" } });
   const bootstrap = await prisma.prospectBootstrap.create({ data: { account_id: "org_mock_1", canonical_website: "https://example.invalid", status: "review_required" } });
   expect(await createManualKnowledgeFact({ bootstrapId: bootstrap.id, sourceId: "no-source", factKey: "business.name", value: "Synthetic", evidenceExcerpt: "Synthetic" })).toMatchObject({ ok: false, error: { code: "account_inactive" } });
   expect(await createAndApproveMemorySnapshot({ bootstrapId: bootstrap.id, reviewAcknowledged: true })).toMatchObject({ ok: false, error: { code: "account_inactive" } });
   expect(await prisma.knowledgeFact.count()).toBe(0);
   expect(await prisma.businessMemorySnapshot.count()).toBe(0);
   expect(await prisma.callSegment.count()).toBe(0);
   expect(await prisma.call.count()).toBe(0);
   expect(await prisma.callTranscript.count()).toBe(0);
   expect(await prisma.crmSyncOperation.count()).toBe(0);
 });
 test("even active status cannot make a malformed or valid setup draft runtime authority", async () => {
   await prisma.account.update({ where: { id: "org_mock_1" }, data: { status: "active" } });
   expect(await accountRuntimeAllowed("org_mock_1")).toBe(false);
   await prisma.account.update({ where: { id: "org_mock_1" }, data: { setup_draft_json: { capabilities: { aiAnswering: true } } } });
   expect(await accountRuntimeAllowed("org_mock_1")).toBe(false);
 });

test("editing drafts preserves published profile and memory byte for byte", async () => {
  const profile = await prisma.agentProfile.create({ data: { account_id: "org_mock_1", name: "Published synthetic", slug: "published", type: "demo_mode", enabled: false, system_policy_json: { published: "unchanged" } } });
  const memory = await prisma.businessMemorySnapshot.create({ data: { account_id: "org_mock_1", schema_version: "synthetic", version: 1, memory_json: { approved: "unchanged" }, content_hash: "synthetic", template_version: "synthetic", status: "approved" } });
  expect(await updateClientSetup("org_mock_1", { revision: 1, draft: draftInput })).toMatchObject({ ok: true });
  expect(await prisma.agentProfile.findUnique({ where: { id: profile.id } })).toEqual(profile);
  expect(await prisma.businessMemorySnapshot.findUnique({ where: { id: memory.id } })).toEqual(memory);
});

test("additive migration preserves existing data and old readers retain setup drafts", async () => {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('CREATE TEMP TABLE "Account" (LIKE public."Account") ON COMMIT DROP');
    await tx.$executeRawUnsafe('ALTER TABLE pg_temp."Account" DROP COLUMN setup_draft_json');
    await tx.$executeRawUnsafe(`INSERT INTO pg_temp."Account" (id,name,slug,industry,timezone,status,account_type,created_at,updated_at) VALUES ('synthetic-existing','Existing Example','existing-example','test','UTC','paused','customer',now(),now())`);
    const before = await tx.$queryRawUnsafe<Array<Record<string, unknown>>>('SELECT row_to_json(a) AS row FROM pg_temp."Account" a');
    await tx.$executeRawUnsafe(readFileSync('prisma/migrations/20261028_inactive_client_setup/migration.sql', 'utf8'));
    const after = await tx.$queryRawUnsafe<Array<{ row: Record<string, unknown> }>>('SELECT row_to_json(a) AS row FROM pg_temp."Account" a');
    expect(after[0].row.setup_draft_json).toBeNull();
    delete after[0].row.setup_draft_json;
    expect(after).toEqual(before);
    await tx.$executeRawUnsafe(`UPDATE pg_temp."Account" SET setup_draft_json = '{"synthetic":"preserve"}'::jsonb`);
    await tx.$queryRawUnsafe('SELECT id,name,slug FROM pg_temp."Account"');
    expect(await tx.$queryRawUnsafe('SELECT setup_draft_json FROM pg_temp."Account"')).toEqual([{ setup_draft_json: { synthetic: "preserve" } }]);
  });
});

test("operator role may create; absent session and client role injection cannot", async () => {
  setDevSession("operator");
  expect(await createClientSetup(fresh)).toMatchObject({ ok: true });
  setDevSession("client_admin@org_mock_1");
  expect(await createClientSetup({ ...fresh, role: "aj_admin" })).toMatchObject({ ok: false, error: { code: "role_denied" } });
  expect(await updateClientSetup("org_mock_2", { revision: 1, draft: draftInput })).toMatchObject({ ok: false, error: { code: "tenant_scope_denied" } });
  const auth = process.env.RESPONSEOS_REQUIRE_AUTH;
  const session = process.env.RESPONSEOS_DEV_SESSION;
  try {
    delete process.env.RESPONSEOS_DEV_SESSION;
    process.env.RESPONSEOS_REQUIRE_AUTH = "1";
    expect(await createClientSetup(fresh)).toMatchObject({ ok: false, error: { code: "no_session" } });
    expect(await updateClientSetup("org_mock_1", { revision: 1, draft: draftInput })).toMatchObject({ ok: false, error: { code: "no_session" } });
  } finally {
    if (auth === undefined) delete process.env.RESPONSEOS_REQUIRE_AUTH; else process.env.RESPONSEOS_REQUIRE_AUTH = auth;
    if (session === undefined) delete process.env.RESPONSEOS_DEV_SESSION; else process.env.RESPONSEOS_DEV_SESSION = session;
  }
});

// Deterministic interleavings: the competing writer holds its transaction open until the
// setup writer is observed waiting on a lock, then commits. Under the original SERIALIZABLE
// design the setup writer never waited for non-participating writers and missed their rows.
async function waitForLockWait(event: "relation" | "advisory") {
  for (let attempt = 0; attempt < 400; attempt++) {
    const [row] = await prisma.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND wait_event = ${event}`;
    if (row.n > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`No setup writer waited on a ${event} lock`);
}

async function holdOpen(work: (tx: Prisma.TransactionClient) => Promise<unknown>) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let ready!: () => void;
  const started = new Promise<void>((resolve) => { ready = resolve; });
  const done = prisma.$transaction(async (tx) => { await work(tx); ready(); await gate; }, { timeout: 20_000, maxWait: 5_000 });
  await Promise.race([started, done]);
  return async () => { release(); await done; };
}

describe("setup writers see rows committed while they wait for locks", () => {
  test.each([
    { label: "non-participating account writer", wait: "relation" as const, work: (tx: Prisma.TransactionClient) => tx.account.create({ data: { name: "BLUEBIRD plumbing!", slug: "bluebird-other-writer", industry: "synthetic", timezone: "UTC", status: "lead" } }) },
    { label: "national-format inventory writer", wait: "relation" as const, work: (tx: Prisma.TransactionClient) => tx.telephonyNumber.create({ data: { provider: "synthetic", provider_number_id: "synthetic-concurrent", e164: "(202) 555-0124", status: "available" } }) },
    { label: "contact capture writer", wait: "relation" as const, work: (tx: Prisma.TransactionClient) => tx.contact.create({ data: { account_id: "org_mock_2", phone: "2025550124", source: "call" } }) },
    { label: "peer setup writer holding the advisory lock", wait: "advisory" as const, work: async (tx: Prisma.TransactionClient) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(190028, 1)`;
      await tx.account.create({ data: { name: "Peer Writer", slug: "peer-writer", industry: "synthetic", timezone: "UTC", status: "paused", setup_draft_json: { contactNumber: "+1 202 555 0124" } } });
    } },
  ])("create refuses after a $label commits", async ({ wait, work }) => {
    const commit = await holdOpen(work);
    let pending: ReturnType<typeof createClientSetup> | undefined;
    try {
      pending = createClientSetup(fresh);
      await waitForLockWait(wait);
    } finally {
      await commit();
    }
    expect(await pending).toMatchObject({ ok: false, error: { code: "duplicate_account" } });
    expect(await prisma.account.count({ where: { slug: fresh.slug } })).toBe(0);
    expect(await prisma.auditLog.count()).toBe(0);
  });
  test("draft edit refuses after a concurrent contact capture commits", async () => {
    const commit = await holdOpen((tx) => tx.contact.create({ data: { account_id: "org_mock_2", phone: "+1 (202) 555-0124", source: "call" } }));
    let pending: ReturnType<typeof updateClientSetup> | undefined;
    try {
      pending = updateClientSetup("org_mock_1", { revision: 1, draft: { ...draftInput, contactNumber: fresh.contactNumber } });
      await waitForLockWait("relation");
    } finally {
      await commit();
    }
    expect(await pending).toMatchObject({ ok: false, error: { code: "duplicate_account" } });
    expect(await prisma.auditLog.count()).toBe(0);
  });
});
