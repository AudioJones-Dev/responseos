import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { normalizeTelnyxEvent } from "@/lib/providers/telnyx/normalize";
import { recordWebhookEvent } from "@/lib/data/webhookEvents";
import { db } from "@/lib/db/client";
import { disconnectTestDb, prisma, resetAndSeedTestDb } from "./setup";

const accountId = "org_responseos_demo";
const phone = "+15555550991";
const demoNumber = "+17867560897";
async function input(index: number, sameCall: boolean) {
  const event = { data: { id: `concurrency-${index}`, event_type: "call.conversation_insights.generated", payload: {
    call_control_id: sameCall ? "shared-call" : `call-${index}`, from: phone, to: demoNumber, summary: "Synthetic operator review required",
  } } };
  const recorded = await recordWebhookEvent({ account_id: accountId, provider: "telnyx", provider_event_id: event.data.id, event_type: event.data.event_type, raw_body: JSON.stringify(event), signature_valid: true });
  if (!recorded.ok) throw new Error("synthetic ledger failed");
  return { accountId, demoNumber, webhookEventId: recorded.data.id, event };
}

describe("cooperating Telnyx normalizers", () => {
  beforeEach(resetAndSeedTestDb);
  afterAll(disconnectTestDb);
  test.each([true, false])("concurrent same-phone normalizers preserve uniqueness (same call: %s)", async sameCall => {
    const inputs = await Promise.all(Array.from({ length: 6 }, (_, index) => input(index, sameCall)));
    await Promise.all(inputs.map(params => normalizeTelnyxEvent(params)));
    expect(await prisma.contact.count({ where: { account_id: accountId, phone } })).toBe(1);
    const calls = await prisma.call.findMany({ where: { account_id: accountId, from_number: phone } });
    expect(calls).toHaveLength(sameCall ? 1 : 6);
    expect(await prisma.leadEvent.count({ where: { call_id: { in: calls.map(call => call.id) } } })).toBe(calls.length);
  });
  test("supplied transaction rolls all canonical writes back without replay", async () => {
    const params = await input(0, true);
    const leadsBefore = await prisma.leadEvent.count({ where: { account_id: accountId } });
    if (!db) throw new Error("database required");
    await expect(db.$transaction(async client => {
      await normalizeTelnyxEvent({ ...params, client });
      throw new Error("synthetic rollback");
    })).rejects.toThrow("synthetic rollback");
    expect(await prisma.contact.count({ where: { account_id: accountId, phone } })).toBe(0);
    expect(await prisma.call.count({ where: { account_id: accountId, from_number: phone } })).toBe(0);
    expect(await prisma.leadEvent.count({ where: { account_id: accountId } })).toBe(leadsBefore);
    expect((await prisma.webhookEvent.findUniqueOrThrow({ where: { id: params.webhookEventId } })).process_status).toBe("received");
  });
});
