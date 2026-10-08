import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { RESPONSEOS_DEMO_ACCOUNT_ID } from "@/lib/demo/constants";
import { runRetentionPurge, type RetentionPurgeReport } from "@/lib/retention/runRetentionPurge";
import { disconnectTestDb, prisma, resetAndSeedTestDb, setDevSession } from "./setup";

const now = new Date("2026-10-08T12:00:00.000Z");
const longAgo = new Date("2026-06-01T12:00:00.000Z");
const lastWeek = new Date("2026-10-01T12:00:00.000Z");
const INBOUND_ACCOUNT_ID = "org_mock_1";
const DEMO_ACCOUNT_ID = RESPONSEOS_DEMO_ACCOUNT_ID;

const SNAPSHOT_TABLES = [
  "Account", "AuditLog", "WebhookEvent", "ProspectIntake", "ProspectBootstrap", "KnowledgeSource",
  "KnowledgeFact", "BusinessMemorySnapshot", "TelephonyNumber", "TelephonyNumberAssignment", "AgentProfile",
  "Call", "CallTranscript", "CallSegment", "Contact", "LeadEvent", "LeadQualification", "CrmSyncOperation",
  "QaLog", "WorkflowRun",
];

async function snapshot(): Promise<Record<string, string>> {
  const hashes: Record<string, string> = {};
  for (const table of SNAPSHOT_TABLES) {
    const [row] = await prisma.$queryRawUnsafe<Array<{ hash: string }>>(
      `SELECT md5(coalesce(string_agg(t::text, '|' ORDER BY t::text), '')) AS hash FROM "${table}" t`,
    );
    hashes[table] = row.hash;
  }
  return hashes;
}

function counts(report: RetentionPurgeReport) {
  expect(report.failure).toBeUndefined();
  return Object.fromEntries(report.sweeps.map((sweep) => [sweep.key, sweep.count]));
}

async function sandboxAccount(slug: string) {
  return prisma.account.create({ data: {
    name: slug, slug, industry: "home-services", timezone: "UTC", status: "lead", account_type: "sandbox",
  } });
}

async function webhook(id: string, data: {
  account_id?: string;
  provider?: string;
  received_at?: Date;
  payload_expires_at?: Date;
}) {
  return prisma.webhookEvent.create({ data: {
    provider: "telnyx",
    provider_event_id: id,
    dedupe_hash: `${id}-hash`,
    event_type: "call.conversation.ended",
    raw_body: `raw caller payload ${id}`,
    signature_header: "signature",
    signature_valid: true,
    ...data,
  } });
}

async function demoCall(id: string, params: { provider?: "telnyx" | "manual"; startedAt: Date; contactId?: string }) {
  return prisma.call.create({ data: {
    id,
    account_id: DEMO_ACCOUNT_ID,
    contact_id: params.contactId,
    provider: params.provider ?? "telnyx",
    provider_call_id: `${id}-provider`,
    direction: "inbound",
    status: "completed",
    from_number: "+13055550150",
    to_number: "+13055550199",
    started_at: params.startedAt,
    transcript: `Private transcript ${id}`,
    summary: `Private summary ${id}`,
  } });
}

async function seedDueData() {
  for (const [reference, status, expiresAt] of [
    ["audit_expired", "received", longAgo],
    ["audit_qualified", "qualified", longAgo],
    ["audit_current", "received", new Date("2026-12-01T00:00:00.000Z")],
  ] as const) {
    await prisma.prospectIntake.create({ data: {
      account_id: INBOUND_ACCOUNT_ID,
      reference,
      idempotency_key: reference,
      payload_hash: reference,
      request_json: { name: "Jordan Vega", email: "jordan@example.com" },
      status,
      expires_at: expiresAt,
    } });
  }

  const expiring = await sandboxAccount("retention-expiring");
  await prisma.prospectBootstrap.create({ data: {
    account_id: expiring.id, canonical_website: "https://expiring.example/", status: "active", expires_at: lastWeek,
  } });
  const contentDue = await sandboxAccount("retention-content");
  await prisma.prospectBootstrap.create({ data: {
    account_id: contentDue.id, canonical_website: "https://content.example/", status: "expired",
    expires_at: lastWeek, content_expires_at: lastWeek,
  } });
  const cleanupDue = await sandboxAccount("retention-cleanup");
  await prisma.prospectBootstrap.create({ data: {
    account_id: cleanupDue.id, canonical_website: "https://cleanup.example/", status: "expired",
    expires_at: new Date("2026-08-01T00:00:00.000Z"), content_purged_at: new Date("2026-08-01T00:00:00.000Z"),
  } });
  await webhook("cleanup-account-event", { account_id: cleanupDue.id, received_at: longAgo });
  const quarantined = await sandboxAccount("retention-quarantine");
  const quarantinedBootstrap = await prisma.prospectBootstrap.create({ data: {
    account_id: quarantined.id, canonical_website: "https://quarantine.example/", status: "expired",
    expires_at: lastWeek, content_purged_at: lastWeek,
  } });
  const number = await prisma.telephonyNumber.create({ data: {
    provider: "telnyx", provider_number_id: "retention-number", e164: "+13055550160", status: "quarantined",
  } });
  await prisma.telephonyNumberAssignment.create({ data: {
    account_id: quarantined.id,
    bootstrap_id: quarantinedBootstrap.id,
    telephony_number_id: number.id,
    provider_assistant_id: "assistant-retention",
    status: "quarantined",
    quarantine_until: lastWeek,
    last_inbound_at: lastWeek,
  } });

  await webhook("unassigned-expired", { payload_expires_at: lastWeek });
  await webhook("tenant-expired", { account_id: INBOUND_ACCOUNT_ID, payload_expires_at: lastWeek });
  await webhook("clerk-expired", { provider: "clerk", payload_expires_at: lastWeek });
  await webhook("tenant-not-expired", { account_id: INBOUND_ACCOUNT_ID, payload_expires_at: new Date("2026-11-01T00:00:00.000Z") });

  const oneTimeCaller = await prisma.contact.create({ data: {
    id: "contact_retention_once", account_id: DEMO_ACCOUNT_ID, phone: "+13055550150", email: "caller@example.com", source: "call",
  } });
  const repeatCaller = await prisma.contact.create({ data: {
    id: "contact_retention_repeat", account_id: DEMO_ACCOUNT_ID, phone: "+13055550151", source: "call",
  } });
  await demoCall("call_retention_old", { startedAt: longAgo, contactId: oneTimeCaller.id });
  await demoCall("call_retention_old_repeat", { startedAt: longAgo, contactId: repeatCaller.id });
  const quotedCaller = await prisma.contact.create({ data: {
    id: "contact_retention_quoted", account_id: DEMO_ACCOUNT_ID, phone: "+13055550152", source: "call",
  } });
  await demoCall("call_retention_old_quoted", { startedAt: longAgo, contactId: quotedCaller.id });
  await prisma.quoteRequest.create({ data: {
    account_id: DEMO_ACCOUNT_ID, contact_id: quotedCaller.id, service_type: "Water heater install",
  } });
  await demoCall("call_retention_recent", { startedAt: lastWeek, contactId: repeatCaller.id });
  await demoCall("call_retention_manual", { provider: "manual", startedAt: longAgo });
  await prisma.callTranscript.create({ data: {
    account_id: DEMO_ACCOUNT_ID, call_id: "call_retention_old", inline_text: "Private canonical transcript", retention_lane: "full",
  } });
  await prisma.callSegment.create({ data: {
    account_id: DEMO_ACCOUNT_ID, call_id: "call_retention_old", sequence: 1, speaker: "caller", text: "Private segment",
    started_at: longAgo, ended_at: longAgo,
  } });
  const lead = await prisma.leadEvent.create({ data: {
    account_id: DEMO_ACCOUNT_ID, contact_id: oneTimeCaller.id, call_id: "call_retention_old", source: "phone",
    event_type: "qualified_lead", notes: "Call back about the leak",
  } });
  await prisma.leadQualification.create({ data: {
    lead_event_id: lead.id, service_needed: "Water heater", service_area_match: true, qualification_score: 80,
    qualification_status: "qualified",
  } });
  await prisma.crmSyncOperation.create({ data: {
    account_id: DEMO_ACCOUNT_ID, operation_key: "crm-call:old", provider: "hubspot", call_id: "call_retention_old",
    status: "succeeded", provider_contact_id: "hubspot-contact-1",
  } });
  await prisma.crmSyncOperation.create({ data: {
    account_id: DEMO_ACCOUNT_ID, operation_key: "crm-call:old-repeat", provider: "hubspot", call_id: "call_retention_old_repeat",
    status: "retryable_failed",
  } });
  await prisma.crmSyncOperation.create({ data: {
    account_id: DEMO_ACCOUNT_ID, operation_key: "crm-call:old-stuck", provider: "hubspot", call_id: "call_retention_old_quoted",
    status: "processing",
  } });
  await webhook("demo-old-unexpiring", { account_id: DEMO_ACCOUNT_ID, received_at: longAgo });
  await webhook("demo-recent-unexpiring", { account_id: DEMO_ACCOUNT_ID, received_at: lastWeek });

  await webhook("clerk-old-unexpiring", { provider: "clerk", received_at: new Date("2026-08-01T00:00:00.000Z") });
  await webhook("clerk-recent-unexpiring", { provider: "clerk", received_at: lastWeek });

  return { cleanupAccountId: cleanupDue.id };
}

const EXPECTED_COUNTS = {
  intake_pii: 1,
  bootstrap_expiry: 1,
  bootstrap_content: 1,
  bootstrap_cleanup: 1,
  number_quarantine: 1,
  webhook_payloads: 3,
  demo_call_content: 3,
  clerk_payloads: 1,
};

function run(mode: "preview" | "apply") {
  return runRetentionPurge({ mode, now, inboundAccountId: INBOUND_ACCOUNT_ID, demoAccountId: DEMO_ACCOUNT_ID });
}

describe("retention purge runner", () => {
  beforeEach(async () => {
    await resetAndSeedTestDb();
    setDevSession("aj_admin");
  });
  afterAll(disconnectTestDb);

  test("preview counts every sweep and writes nothing", async () => {
    await seedDueData();
    const before = await snapshot();
    const report = await run("preview");
    expect(counts(report)).toEqual(EXPECTED_COUNTS);
    expect(report.sweeps.find(({ key }) => key === "demo_call_content")?.details).toEqual({ webhookPayloads: 1 });
    expect(report.sweeps.find(({ key }) => key === "number_quarantine")?.details).toEqual({ eligible: 0 });
    expect(await snapshot()).toEqual(before);
  });

  test("preview with nothing due writes nothing", async () => {
    const before = await snapshot();
    const report = await run("preview");
    expect(Object.values(counts(report)).every((count) => count === 0)).toBe(true);
    expect(await snapshot()).toEqual(before);
  });

  test("skips account-scoped sweeps whose account is not configured", async () => {
    await seedDueData();
    const before = await snapshot();
    const report = await runRetentionPurge({ mode: "preview", now });
    const skipped = report.sweeps.filter(({ skipped }) => skipped).map(({ key }) => key);
    expect(skipped).toEqual(["intake_pii", "demo_call_content"]);
    expect(await snapshot()).toEqual(before);
  });

  test("apply purges each category, audits each changing sweep, and is idempotent", async () => {
    const { cleanupAccountId } = await seedDueData();
    const auditBefore = await prisma.auditLog.count();
    expect(counts(await run("apply"))).toEqual(EXPECTED_COUNTS);

    expect(await prisma.prospectIntake.findUnique({ where: { reference: "audit_expired" } }))
      .toMatchObject({ request_json: null, purged_at: now });
    expect(await prisma.prospectIntake.findUnique({ where: { reference: "audit_qualified" } }))
      .toMatchObject({ request_json: expect.anything(), purged_at: null });
    expect(await prisma.prospectIntake.findUnique({ where: { reference: "audit_current" } }))
      .toMatchObject({ purged_at: null });

    expect(await prisma.webhookEvent.findUnique({ where: { dedupe_hash: "cleanup-account-event-hash" } }))
      .toMatchObject({ raw_body: "<PURGED_PROSPECT_DEMO_PAYLOAD>", payload_purged_at: now });
    expect(await prisma.account.findUnique({ where: { id: cleanupAccountId } })).toMatchObject({ status: "cancelled" });

    for (const id of ["unassigned-expired", "tenant-expired", "clerk-expired", "demo-old-unexpiring", "clerk-old-unexpiring"]) {
      expect(await prisma.webhookEvent.findUnique({ where: { dedupe_hash: `${id}-hash` } }))
        .toMatchObject({ raw_body: "<PURGED_WEBHOOK_PAYLOAD>", signature_header: null, payload_purged_at: now });
    }
    for (const id of ["tenant-not-expired", "demo-recent-unexpiring", "clerk-recent-unexpiring"]) {
      expect(await prisma.webhookEvent.findUnique({ where: { dedupe_hash: `${id}-hash` } }))
        .toMatchObject({ raw_body: `raw caller payload ${id}`, payload_purged_at: null });
    }

    for (const id of ["call_retention_old", "call_retention_old_repeat", "call_retention_old_quoted"]) {
      expect(await prisma.call.findUnique({ where: { id } })).toMatchObject({
        from_number: "<PURGED>", contact_id: null, transcript: null, summary: null,
      });
    }
    for (const id of ["call_retention_recent", "call_retention_manual"]) {
      expect(await prisma.call.findUnique({ where: { id } })).toMatchObject({
        from_number: "+13055550150", transcript: `Private transcript ${id}`,
      });
    }
    expect(await prisma.callTranscript.findUnique({ where: { call_id: "call_retention_old" } }))
      .toMatchObject({ inline_text: null, retention_lane: "metadata_only", redacted_at: now });
    expect(await prisma.callSegment.count({ where: { call_id: "call_retention_old" } })).toBe(0);
    expect(await prisma.leadEvent.count({ where: { call_id: "call_retention_old" } })).toBe(0);
    expect(await prisma.leadQualification.count({ where: { service_needed: "Water heater" } })).toBe(0);
    expect(await prisma.contact.findUnique({ where: { id: "contact_retention_once" } })).toBeNull();
    expect(await prisma.contact.findUnique({ where: { id: "contact_retention_repeat" } })).not.toBeNull();
    expect(await prisma.contact.findUnique({ where: { id: "contact_retention_quoted" } })).not.toBeNull();
    expect(await prisma.crmSyncOperation.findUnique({ where: { operation_key: "crm-call:old" } }))
      .toMatchObject({ status: "succeeded", provider_contact_id: "hubspot-contact-1" });
    for (const operation_key of ["crm-call:old-repeat", "crm-call:old-stuck"]) {
      expect(await prisma.crmSyncOperation.findUnique({ where: { operation_key } }))
        .toMatchObject({ status: "cancelled", last_error_code: "retention_purged" });
    }
    expect(await prisma.call.findUnique({ where: { id: "call_responseos_demo" } }))
      .toMatchObject({ from_number: "+15555550811" });

    const audits = await prisma.auditLog.findMany({
      where: { action: { startsWith: "retention." } },
      orderBy: [{ action: "asc" }, { account_id: "asc" }],
    });
    expect(audits.map(({ action, account_id }) => [action, account_id])).toEqual([
      ["retention.clerk_payloads_scrubbed", null],
      ["retention.demo_call_content_purged", DEMO_ACCOUNT_ID],
      ["retention.intake_pii_purged", INBOUND_ACCOUNT_ID],
      ["retention.webhook_payloads_scrubbed", INBOUND_ACCOUNT_ID],
      ["retention.webhook_payloads_scrubbed", null],
    ]);
    for (const audit of audits) {
      expect(audit).toMatchObject({ actor_type: "system", category: "workflow", expires_at: new Date("2027-10-08T12:00:00.000Z") });
    }
    expect(audits.find(({ action, account_id }) => action === "retention.webhook_payloads_scrubbed" && account_id === null)?.metadata_json)
      .toEqual({ scrubbed: 2, byProvider: { telnyx: 1, clerk: 1 } });
    expect(audits.find(({ action }) => action === "retention.demo_call_content_purged")?.metadata_json).toMatchObject({
      calls: 3, webhookPayloads: 1, segmentsDeleted: 1, transcriptsRedacted: 1, leadsDeleted: 1,
      qualificationsDeleted: 1, contactsDeleted: 1, crmOperationsCancelled: 2, crmCopyDeleted: false,
    });
    const bootstrapAudits = await prisma.auditLog.findMany({ where: { action: { startsWith: "prospect_bootstrap." } } });
    expect(bootstrapAudits.map(({ action }) => action).sort()).toEqual([
      "prospect_bootstrap.cleaned",
      "prospect_bootstrap.content_purged",
      "prospect_bootstrap.expired",
      "prospect_bootstrap.number_quarantine_extended",
    ]);
    const auditAfterFirstApply = await prisma.auditLog.count();
    expect(auditAfterFirstApply - auditBefore).toBe(9);

    const second = await run("apply");
    expect(Object.values(counts(second)).every((count) => count === 0)).toBe(true);
    expect(await prisma.auditLog.count()).toBe(auditAfterFirstApply);
  });
});
