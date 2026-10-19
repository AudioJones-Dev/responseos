import { expireFingerprintFixture } from "./expire-fingerprint-fixture";
import { afterAll, afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { generateKeyPairSync, sign } from "node:crypto";
import { deferredCallbacks } from "./deferredCallbacks";
vi.mock("next/server", async original => ({ ...await original<typeof import("next/server")>(), after: (task: () => unknown) => deferredCallbacks.push(task) }));
import { recordWebhookEvent, backfillWebhookEvent, computeDedupeHash } from "@/lib/data/webhookEvents";
import { contentFingerprint } from "@/lib/providers/telnyx/fingerprint";
import { MockCrmProvider } from "@/lib/providers/crm";
import { disconnectTestDb, prisma, resetAndSeedTestDb } from "./setup";

const keys = generateKeyPairSync("ed25519");
const accountId = "org_responseos_demo", number = "+15555550199";
function body(id = "fingerprint-route") {
  return JSON.stringify({ data: { id, event_type: "call.conversation_insights.generated", occurred_at: new Date().toISOString(), payload: { call_control_id: id, to: number, from: "+15555550991", summary: "Synthetic result", qualification: { status: "qualified" }, next_action: "Synthetic callback" } } });
}
function request(raw: string) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  return new Request("http://localhost", { method: "POST", headers: { "content-type": "application/json", "telnyx-timestamp": timestamp, "telnyx-signature-ed25519": sign(null, Buffer.concat([Buffer.from(`${timestamp}|`), Buffer.from(raw)]), keys.privateKey).toString("base64") }, body: raw });
}
function record(raw: string, id = "runtime-ledger") {
  return recordWebhookEvent({ provider: "telnyx", provider_event_id: id, event_type: "synthetic", raw_body: "<REDACTED>", signature_valid: true, verifiedBytes: Buffer.from(raw) });
}

describe("application fingerprint boundaries", () => {
  beforeEach(async () => {
    await resetAndSeedTestDb();
    deferredCallbacks.length = 0;
    vi.stubEnv("TELNYX_PUBLIC_KEY", keys.publicKey.export({ type: "spki", format: "pem" }).toString());
    vi.stubEnv("RESPONSEOS_LIVE_TELNYX_INGEST_ENABLED", "true");
    vi.stubEnv("RESPONSEOS_LIVE_HUBSPOT_ENABLED", "false");
    vi.stubEnv("RESPONSEOS_DEMO_ACCOUNT_ID", accountId);
    vi.stubEnv("RESPONSEOS_DEMO_PHONE_E164", number);
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
  afterAll(disconnectTestDb);

  test("signed changed originals stop before callbacks and final CRM sink; identical lost-ack retry is idempotent", async () => {
    const { POST } = await import("@/app/api/webhooks/telnyx/calls/route");
    const raw = body(), create = vi.spyOn(MockCrmProvider.prototype, "createContact");
    expect((await POST(request(raw))).status).toBe(202);
    const saved = await prisma.webhookEvent.findFirstOrThrow({ where: { provider_event_id: "fingerprint-route" } });
    expect(saved.content_fingerprint).toBe(contentFingerprint(Buffer.from(raw), Buffer.alloc(32, 0x42)));
    deferredCallbacks.length = 0; // Model lost acknowledgement/worker before canonical writes.
    await prisma.webhookEvent.update({ where: { id: saved.id }, data: { received_at: new Date(0) } });
    for (const changed of [raw + "\n", raw.replace("Synthetic result", "Changed result")]) expect((await POST(request(changed))).status).toBe(503);
    expect(deferredCallbacks).toHaveLength(0);
    expect(create).not.toHaveBeenCalled();
    expect((await POST(request(raw))).status).toBe(200);
    for (const callback of deferredCallbacks.splice(0)) await callback();
    expect(create).toHaveBeenCalledOnce();
    expect((await POST(request(raw))).status).toBe(200);
    expect(deferredCallbacks).toHaveLength(0);
    expect(create).toHaveBeenCalledOnce();
  });

  test("concurrent conflicting originals establish one immutable winner even when stored body is redacted", async () => {
    const results = await Promise.all([record("one"), record("two"), record("one")]);
    const saved = await prisma.webhookEvent.findFirstOrThrow({ where: { provider_event_id: "runtime-ledger" } });
    expect(await prisma.webhookEvent.count({ where: { provider_event_id: "runtime-ledger" } })).toBe(1);
    expect(results.some(result => !result.ok && result.error.code === "webhook_fingerprint_conflict")).toBe(true);
    const original = saved.content_fingerprint === contentFingerprint(Buffer.from("one"), Buffer.alloc(32, 0x42)) ? "one" : "two";
    expect((await record(original)).ok).toBe(true);
    expect(saved.raw_body).toBe("<REDACTED>");
  });

  test("legacy, expired and erased identities cannot recover or backfill", async () => {
    await prisma.webhookEvent.create({ data: { provider: "telnyx", provider_event_id: "legacy", event_type: "synthetic", dedupe_hash: computeDedupeHash("telnyx", "legacy"), raw_body: "old", signature_valid: true } });
    expect((await record("old", "legacy")).ok).toBe(false);
    const created = await record("original");
    if (!created.ok) throw new Error("fixture failed");
    const [{ now }] = await prisma.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() - interval '1 second' AS now`;
    await expireFingerprintFixture(created.data.id, now);
    expect((await record("original")).ok).toBe(false);
    await prisma.webhookEvent.update({ where: { id: created.data.id }, data: { payload_purged_at: now, raw_body: "<PURGED_WEBHOOK_PAYLOAD>" } });
    await expect(backfillWebhookEvent({ id: created.data.id, account_id: accountId, raw_body: "original", verifiedBytes: Buffer.from("original"), payload_expires_at: null })).rejects.toThrow("webhook_fingerprint_expired_or_purged");
    expect((await record("original")).ok).toBe(false);
    expect((await prisma.webhookEvent.findUniqueOrThrow({ where: { id: created.data.id } })).raw_body).toBe("<PURGED_WEBHOOK_PAYLOAD>");
  });

  test("key removal or replacement prevents signed retry before normalization", async () => {
    const { POST } = await import("@/app/api/webhooks/telnyx/calls/route");
    const raw = body();
    expect((await POST(request(raw))).status).toBe(202);
    deferredCallbacks.length = 0;
    for (const keysJson of [JSON.stringify({ replacement: "43".repeat(32) }), JSON.stringify({ "synthetic-local-v1": "43".repeat(32) })]) {
      vi.stubEnv("RESPONSEOS_WEBHOOK_FINGERPRINT_KEYS_JSON", keysJson);
      vi.stubEnv("RESPONSEOS_WEBHOOK_FINGERPRINT_KEY_ID", keysJson.includes("replacement") ? "replacement" : "synthetic-local-v1");
      expect((await POST(request(raw))).status).toBe(503);
      expect(deferredCallbacks).toHaveLength(0);
    }
  });

  test("expiry between acknowledgement and callback prevents canonical data and CRM", async () => {
    const { POST } = await import("@/app/api/webhooks/telnyx/calls/route");
    const raw = body(), create = vi.spyOn(MockCrmProvider.prototype, "createContact");
    expect((await POST(request(raw))).status).toBe(202);
    await expireFingerprintFixture((await prisma.webhookEvent.findFirstOrThrow({ where: { provider_event_id: "fingerprint-route" } })).id, new Date(0));
    for (const callback of deferredCallbacks.splice(0)) await callback();
    expect(await prisma.call.count({ where: { provider_call_id: "fingerprint-route" } })).toBe(0);
    expect(create).not.toHaveBeenCalled();
  });
});
