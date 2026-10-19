import { expireFingerprintFixture } from "./expire-fingerprint-fixture";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import { db } from "@/lib/db/client";
import { normalizeTelnyxEvent } from "@/lib/providers/telnyx/normalize";
import { recordWebhookEvent } from "@/lib/data/webhookEvents";
import { purgeExpiredDemoCallContent } from "@/lib/retention/demoCallContent";
import { cleanupExpiredProspectBootstraps, purgeExpiredProspectContent } from "@/lib/prospectBootstrap/service";
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
    verifiedBytes: Buffer.from(JSON.stringify(event)), raw_body: JSON.stringify(event),
    signature_valid: true,
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.data.id;
}

describe("Telnyx canonical normalization", () => {
  beforeEach(resetAndSeedTestDb);
  afterAll(disconnectTestDb);

  test.each(["general", "prospect", "cleanup"])("normalization queued behind %s cannot restore purged content", async lane => {
    const now = new Date("2026-10-18T12:00:00Z"), old = new Date("2026-01-01T12:00:00Z");
    if (lane !== "general") await prisma.prospectBootstrap.create({ data: { account_id: accountId, canonical_website: "https://synthetic.example.test", status: "expired", content_expires_at: old, expires_at: old } });
    await prisma.call.create({ data: { account_id: accountId, provider: "telnyx", provider_call_id: "purge-first", direction: "inbound", status: "completed", from_number: "+15555550177", to_number: demoNumber, started_at: old } });
    const event: TelnyxWebhookEnvelope = { data: { id: "purge-first-event", event_type: "call.conversation_insights.generated", payload: { call_control_id: "purge-first", from: "+15555550177", to: demoNumber, transcript: "Synthetic private content" } } };
    const webhookEventId = await ledger(event);
    if (lane === "cleanup") await expireFingerprintFixture(webhookEventId, old);
    let ready!: () => void, release!: () => void;
    const held = new Promise<void>(resolve => { ready = resolve; });
    const released = new Promise<void>(resolve => { release = resolve; });
    if (!db) throw new Error("Database required");
    const transaction = db.$transaction.bind(db);
    const pause = vi.spyOn(db, "$transaction").mockImplementationOnce((async (callback: (tx: unknown) => Promise<unknown>) => transaction(async tx => {
      const result = await callback(tx); ready(); await released; return result;
    }, { timeout: 10_000 })) as typeof db.$transaction);
    const purge = lane === "general" ? purgeExpiredDemoCallContent({ accountId, now }) : lane === "prospect" ? purgeExpiredProspectContent(now) : cleanupExpiredProspectBootstraps(now);
    let normalization: ReturnType<typeof normalizeTelnyxEvent> | undefined;
    try {
      await Promise.race([held, purge.then(() => { throw new Error("Purge did not reach commit barrier"); })]);
      normalization = normalizeTelnyxEvent({ accountId, demoNumber, webhookEventId, event });
      let waiting = false;
      for (let attempt = 0; attempt < 100 && !waiting; attempt++) {
        const locks = await prisma.$queryRaw<{ present: boolean }[]>`SELECT EXISTS(SELECT 1 FROM pg_locks WHERE locktype = 'advisory' AND classid = 1380930382 AND objid = (hashtext(${accountId})::bigint & 4294967295)::oid AND NOT granted) AS present`;
        waiting = locks[0].present;
        if (!waiting) await new Promise(resolve => setTimeout(resolve, 20));
      }
      expect(waiting).toBe(true);
    } finally { release(); pause.mockRestore(); expect((await purge).ok).toBe(true); }
    expect(await normalization).toEqual({ callId: null, finalized: false });
    expect(await prisma.contact.count({ where: { account_id: accountId, phone: "+15555550177" } })).toBe(0);
    expect(await prisma.call.count({ where: { account_id: accountId, provider_call_id: "purge-first", from_number: { not: "<PURGED>" } } })).toBe(0);
    expect(await prisma.webhookEvent.findUnique({ where: { id: webhookEventId } })).toMatchObject({ process_status: "rejected", process_error: lane === "cleanup" ? "prospect_content_cleaned" : "call_content_purged" });
  });

  test("elapsed account cleanup leaves an unexpired fingerprint and account intact", async () => {
    const old = new Date("2026-01-01T12:00:00Z");
    const bootstrap = await prisma.prospectBootstrap.create({ data: { account_id: accountId, canonical_website: "https://synthetic.example.test", status: "expired", content_expires_at: old, expires_at: old } });
    const event: TelnyxWebhookEnvelope = { data: { id: "cleanup-blocked", event_type: "call.initiated", payload: { call_control_id: "cleanup-blocked", from: "+15555550177", to: demoNumber } } };
    const id = await ledger(event);
    const before = await prisma.webhookEvent.findUniqueOrThrow({ where: { id } });
    const result = await cleanupExpiredProspectBootstraps(new Date());
    expect(result).toMatchObject({ ok: true, data: { cleaned: 0, blocked: [{ accountId }] } });
    expect(await prisma.webhookEvent.findUniqueOrThrow({ where: { id } })).toEqual(before);
    expect(await prisma.prospectBootstrap.findUniqueOrThrow({ where: { id: bootstrap.id } })).toMatchObject({ status: "expired" });
    expect((await prisma.account.findUniqueOrThrow({ where: { id: accountId } })).status).not.toBe("cancelled");
  });

  test.each(["general", "prospect"])("%s purge waits for normalization and late replay cannot restore content", async lane => {
    const now = new Date("2026-10-18T12:00:00Z");
    const old = new Date("2026-01-01T12:00:00Z");
    if (lane === "prospect") await prisma.prospectBootstrap.create({ data: {
      account_id: accountId, canonical_website: "https://synthetic.example.test", status: "expired", content_expires_at: old,
    } });
    await prisma.call.create({ data: {
      account_id: accountId, provider: "telnyx", provider_call_id: "purge-race", direction: "inbound",
      status: "completed", from_number: "+17865550177", to_number: demoNumber, started_at: old,
    } });
    const event: TelnyxWebhookEnvelope = { data: { id: "race-insights", event_type: "call.conversation_insights.generated", occurred_at: old.toISOString(), payload: {
      call_control_id: "purge-race", from: "+17865550177", to: demoNumber, transcript: "Synthetic private content", summary: "Synthetic summary",
    } } };
    const webhookEventId = await ledger(event);
    let purging: ReturnType<typeof purgeExpiredDemoCallContent> | ReturnType<typeof purgeExpiredProspectContent> | undefined;
    try {
      await prisma.$transaction(async tx => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(1380930382, hashtext(${accountId}))`;
        purging = lane === "general" ? purgeExpiredDemoCallContent({ accountId, now }) : purgeExpiredProspectContent(now);
        let waiting = false;
        for (let attempt = 0; attempt < 100 && !waiting; attempt++) {
          await tx.$executeRaw`SELECT pg_stat_clear_snapshot()`;
          const locks = await tx.$queryRaw<{ present: boolean }[]>`SELECT EXISTS(SELECT 1 FROM pg_locks WHERE locktype = 'advisory' AND classid = 1380930382 AND objid = (hashtext(${accountId})::bigint & 4294967295)::oid AND NOT granted) AS present`;
          waiting = locks[0].present;
          if (!waiting) await new Promise(resolve => setTimeout(resolve, 20));
        }
        expect(waiting).toBe(true);
        await normalizeTelnyxEvent({ client: tx, accountId, demoNumber, webhookEventId, event });
      }, { timeout: 10_000 });
    } finally { if (purging) expect((await purging).ok).toBe(true); }
    const replay = { data: { ...event.data, id: "race-replay" } };
    expect(await normalizeTelnyxEvent({ accountId, demoNumber, webhookEventId: await ledger(replay), event: replay })).toEqual({ callId: null, finalized: false });
    const call = await prisma.call.findFirstOrThrow({ where: { account_id: accountId, provider_call_id: "purge-race" } });
    expect(call).toMatchObject({ from_number: "<PURGED>", contact_id: null, transcript: null, summary: null });
    expect(await prisma.leadEvent.count({ where: { call_id: call.id } })).toBe(0);
    expect(await prisma.contact.count({ where: { account_id: accountId, phone: "+17865550177" } })).toBe(0);
    expect(await prisma.callTranscript.findFirst({ where: { call_id: call.id } })).toMatchObject({ inline_text: null });
  });

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

  test("a quote request carrying no qualification evidence stays an unscored lead", async () => {
    // The caller asked for a quote and the provider returned no qualification
    // block. That is an unscored lead, not a refused one, so it must not be
    // recorded as unqualified.
    const insights: TelnyxWebhookEnvelope = {
      data: {
        id: "telnyx-event-quote-only",
        event_type: "call.conversation_insights.generated",
        occurred_at: "2026-08-18T15:04:00.000Z",
        payload: {
          call_control_id: "telnyx-call-quote",
          from: "+17865550103",
          to: demoNumber,
          summary: "Caller asked what a vertical platform lift would cost.",
          quote_requested: true,
        },
      },
    };
    await normalizeTelnyxEvent({ accountId, demoNumber, webhookEventId: await ledger(insights), event: insights });
    const call = await prisma.call.findFirstOrThrow({ where: { account_id: accountId, provider_call_id: "telnyx-call-quote" } });
    const lead = await prisma.leadEvent.findFirstOrThrow({ where: { call_id: call.id } });
    expect(lead).toMatchObject({ status: "new", event_type: "quote_request" });
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

  test("does not write caller content onto a call whose content was purged", async () => {
    await prisma.call.create({ data: {
      account_id: accountId, provider: "telnyx", provider_call_id: "purged-call", direction: "inbound",
      status: "completed", from_number: "<PURGED>", to_number: demoNumber, started_at: new Date("2026-06-01T12:00:00.000Z"),
    } });
    const event: TelnyxWebhookEnvelope = {
      data: {
        id: "telnyx-late-insights",
        event_type: "call.conversation_insights.generated",
        payload: {
          call_control_id: "purged-call",
          from: "+17865550177",
          to: demoNumber,
          transcript: "Late transcript with caller details",
        },
      },
    };
    const webhookEventId = await ledger(event);
    const result = await normalizeTelnyxEvent({ accountId, demoNumber, webhookEventId, event });
    expect(result).toEqual({ callId: null, finalized: false });
    expect(await prisma.call.findFirst({ where: { provider_call_id: "purged-call" } }))
      .toMatchObject({ from_number: "<PURGED>", contact_id: null, transcript: null, summary: null });
    expect(await prisma.contact.count({ where: { phone: "+17865550177" } })).toBe(0);
    expect(await prisma.webhookEvent.findUnique({ where: { id: webhookEventId } }))
      .toMatchObject({ process_status: "rejected", process_error: "call_content_purged" });
  });
});
