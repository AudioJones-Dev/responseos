import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { normalizeTelnyxEvent } from "@/lib/providers/telnyx/normalize";
import { recordWebhookEvent } from "@/lib/data/webhookEvents";
import type { TelnyxWebhookEnvelope } from "@/lib/providers/telnyx/webhook";
import { disconnectTestDb, prisma, resetAndSeedTestDb } from "./setup";

const accountId = "org_responseos_demo";
const demoNumber = "+17867560897";

async function ledger(event: TelnyxWebhookEnvelope) {
  const result = await recordWebhookEvent({
    account_id: accountId,
    provider: "telnyx",
    provider_event_id: event.data.id,
    event_type: event.data.event_type,
    raw_body: JSON.stringify(event),
    signature_valid: true,
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.data.id;
}

describe("Telnyx canonical normalization", () => {
  beforeEach(resetAndSeedTestDb);
  afterAll(disconnectTestDb);

  test("handles insights before lifecycle events without duplicate calls", async () => {
    const insights: TelnyxWebhookEnvelope = {
      data: {
        id: "telnyx-event-insights",
        event_type: "call.conversation_insights.generated",
        occurred_at: "2026-08-18T15:04:00.000Z",
        payload: {
          call_control_id: "telnyx-call-001",
          from: "+17865550101",
          to: demoNumber,
          summary: "Caller requested a callback for an operations assessment.",
          transcript: [{ role: "caller", content: "Please have a person call me." }],
          qualification: {
            status: "qualified",
            score: 91,
            service_needed: "Operations assessment",
            next_action: "Human callback",
          },
        },
      },
    };
    const normalized = await normalizeTelnyxEvent({
      accountId,
      demoNumber,
      webhookEventId: await ledger(insights),
      event: insights,
    });
    expect(normalized.finalized).toBe(true);

    const started: TelnyxWebhookEnvelope = {
      data: {
        id: "telnyx-event-started",
        event_type: "call.initiated",
        occurred_at: "2026-08-18T15:00:00.000Z",
        payload: {
          call_control_id: "telnyx-call-001",
          from: "+17865550101",
          to: demoNumber,
          start_time: "2026-08-18T15:00:00.000Z",
        },
      },
    };
    await normalizeTelnyxEvent({
      accountId,
      demoNumber,
      webhookEventId: await ledger(started),
      event: started,
    });

    const calls = await prisma.call.findMany({
      where: { account_id: accountId, provider: "telnyx", provider_call_id: "telnyx-call-001" },
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ status: "completed", summary: expect.stringContaining("callback") });
    expect(await prisma.callTranscript.count({ where: { call_id: calls[0].id } })).toBe(1);
    const lead = await prisma.leadEvent.findFirst({ where: { call_id: calls[0].id } });
    expect(lead?.status).toBe("qualified");
  });

  test("rejects a signed event for another destination without a call mutation", async () => {
    const event: TelnyxWebhookEnvelope = {
      data: {
        id: "telnyx-wrong-number",
        event_type: "call.initiated",
        payload: { call_control_id: "other-call", from: "+17865550102", to: "+17865559999" },
      },
    };
    const webhookEventId = await ledger(event);
    const result = await normalizeTelnyxEvent({ accountId, demoNumber, webhookEventId, event });
    expect(result.callId).toBeNull();
    expect(await prisma.call.count({ where: { provider_call_id: "other-call" } })).toBe(0);
    expect((await prisma.webhookEvent.findUnique({ where: { id: webhookEventId } }))?.process_status)
      .toBe("rejected");
  });
});
