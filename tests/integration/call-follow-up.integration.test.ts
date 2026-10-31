import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { normalizeTelnyxEvent } from "@/lib/providers/telnyx/normalize";
import { recordWebhookEvent } from "@/lib/data/webhookEvents";
import { followUpRoutingReady, listCallFollowUps, resolveCallFollowUp } from "@/lib/followUp/service";
import type { TelnyxWebhookEnvelope } from "@/lib/providers/telnyx/webhook";
import { disconnectTestDb, prisma, resetAndSeedTestDb, setDevSession } from "./setup";

const accountId = "org_responseos_demo";
const demoNumber = "+17867560897";

function finalized(id: string, qualification?: Record<string, unknown>): TelnyxWebhookEnvelope {
  return {
    data: {
      id: `event-${id}`,
      event_type: "call.conversation_insights.generated",
      occurred_at: "2026-10-31T15:04:00.000Z",
      payload: {
        call_control_id: `call-${id}`,
        from: "+17865550101",
        to: demoNumber,
        ...(qualification ? { summary: "Synthetic caller asked a question.", qualification } : {}),
      },
    },
  };
}

async function normalize(event: TelnyxWebhookEnvelope) {
  const ledger = await recordWebhookEvent({
    account_id: accountId, provider: "telnyx", provider_event_id: event.data.id,
    event_type: event.data.event_type, raw_body: JSON.stringify(event), signature_valid: true,
  });
  if (!ledger.ok) throw new Error(ledger.error.message);
  return normalizeTelnyxEvent({ accountId, demoNumber, webhookEventId: ledger.data.id, event });
}

async function followUpFor(callControlId: string) {
  const call = await prisma.call.findFirstOrThrow({ where: { account_id: accountId, provider_call_id: callControlId } });
  return prisma.callFollowUp.findMany({ where: { account_id: accountId, call_id: call.id } });
}

describe("human follow-up for non-qualified calls (ADR-0086)", () => {
  beforeEach(async () => {
    await resetAndSeedTestDb();
    setDevSession("aj_admin");
    await prisma.followUpRouting.create({ data: { account_id: accountId, owner_user_id: "synthetic-owner", backup_user_id: "synthetic-backup" } });
  });
  afterAll(disconnectTestDb);

  test.each([
    { label: "unqualified", qualification: { status: "unqualified" }, reason: "unqualified" },
    { label: "unknown status scores maybe", qualification: { status: "unsure" }, reason: "maybe" },
    { label: "not scored", qualification: undefined, reason: "not_scored" },
  ])("$label creates one open record with owner, backup and due time", async ({ label, qualification, reason }) => {
    const id = label.replaceAll(" ", "-");
    const before = Date.now();
    await normalize(finalized(id, qualification));
    await normalize({ data: { ...finalized(id, qualification).data, id: `event-${id}-replay` } });
    const rows = await followUpFor(`call-${id}`);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ reason, status: "open", owner_user_id: "synthetic-owner", backup_user_id: "synthetic-backup" });
    expect(rows[0].due_at.getTime()).toBeGreaterThanOrEqual(before + 24 * 60 * 60 * 1000);
    expect(await prisma.auditLog.count({ where: { account_id: accountId, action: "call_follow_up.created" } })).toBe(1);
    expect(JSON.stringify(rows[0])).not.toContain("Synthetic caller");
  });

  test.each([{ status: "qualified" }, { status: "spam" }])("a $status call creates no follow-up", async (qualification) => {
    await normalize(finalized(qualification.status, qualification));
    expect(await followUpFor(`call-${qualification.status}`)).toHaveLength(0);
  });

  test("a later qualified re-score never closes an open follow-up", async () => {
    await normalize(finalized("rescore", { status: "unqualified" }));
    await normalize({ data: { ...finalized("rescore", { status: "qualified" }).data, id: "event-rescore-2" } });
    expect(await followUpFor("call-rescore")).toMatchObject([{ status: "open", reason: "unqualified" }]);
  });

  test("missing routing records an audited gap instead of a silent absence", async () => {
    await prisma.followUpRouting.delete({ where: { account_id: accountId } });
    expect(await followUpRoutingReady(accountId)).toBe(false);
    await normalize(finalized("no-routing", { status: "unqualified" }));
    expect(await followUpFor("call-no-routing")).toHaveLength(0);
    expect(await prisma.auditLog.count({ where: { account_id: accountId, action: "call_follow_up.routing_missing" } })).toBe(1);
  });

  test("operators resolve once, with audit; other tenants and client roles cannot", async () => {
    await normalize(finalized("resolve", { status: "unqualified" }));
    const [row] = await followUpFor("call-resolve");
    expect(await resolveCallFollowUp({ id: row.id, accountId: "org_mock_1" })).toMatchObject({ ok: false, error: { code: "not_found" } });
    setDevSession("client_admin@org_mock_1");
    expect(await resolveCallFollowUp({ id: row.id, accountId })).toMatchObject({ ok: false, error: { code: "role_denied" } });
    expect(await listCallFollowUps({ accountId })).toMatchObject({ ok: false, error: { code: "role_denied" } });
    setDevSession("operator");
    expect(await resolveCallFollowUp({ id: row.id, accountId })).toMatchObject({ ok: true, data: { status: "resolved" } });
    expect(await resolveCallFollowUp({ id: row.id, accountId })).toMatchObject({ ok: false, error: { code: "invalid_transition" } });
    expect(await prisma.auditLog.count({ where: { account_id: accountId, action: "call_follow_up.resolved", target_id: row.id } })).toBe(1);
    expect(await listCallFollowUps({ accountId })).toMatchObject({ ok: true, data: [{ id: row.id, status: "resolved" }] });
  });
});
