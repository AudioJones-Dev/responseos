import { afterAll, beforeEach, expect, test } from "vitest";
import { Prisma } from "@prisma/client";
import { disconnectTestDb, prisma, resetAndSeedTestDb, setDevSession } from "./setup";
import { buildOperatingConfigurationSnapshot } from "@/lib/agentExecution/operatingConfigurationSnapshot";
import { canRetainCallContent } from "@/lib/callReview/consent";
import { decideCallReview, queueCallReview } from "@/lib/callReview/service";
import { runCrmSyncForCall } from "@/lib/crm/syncFinalizedCall";
import { dispatchCompletedInteractionNotification } from "@/lib/notifications/completedInteraction";
import { MockCrmProvider } from "@/lib/providers/crm";
import { ReviewPayloadSchema } from "@/lib/callReview/contracts";

const now = new Date();
const value = ReviewPayloadSchema.parse({ caller: "Example Caller", phone: "+15555550199", interaction: "new_sales", product: "ramp", location: "Example city", summary: "Request for ramp evaluation.", qualification: "qualified", outcome: "QUALIFIED_FREE_EVALUATION", urgency: "medium", callbackWindow: "Tomorrow", nextAction: "Call back", flags: [] });
let accountId: string;
let callId: string;

beforeEach(async () => {
  await resetAndSeedTestDb(); setDevSession("operator");
  const account = await prisma.account.create({ data: { name: "Example demo", slug: "call-review-fixture", industry: "home-services", timezone: "America/New_York" } });
  accountId = account.id;
  const { memory } = buildOperatingConfigurationSnapshot({ accountId, generatedAt: now, assertion: { sourceId: "fixture", recordRef: "fixture-only", contentHash: "f".repeat(64), assertedBy: "test", assertedAt: now }, entries: [
    { key: "policy.consent", value: { aiDisclosure: "An automated demonstration.", transcription: { enabled: true }, recording: { enabled: false }, refusal: { acknowledgement: "Understood", stopRecordingWhenSupported: true, offer: "callback_only", minimizeCollection: true } } },
    { key: "notification.completed_interaction.recipient", value: { channel: "email", recipient: "owner@example.test", event: "completed_interaction", enabled: true, temporary: true } },
  ] });
  await prisma.callCaptureSession.create({ data: { account_id: accountId, provider_call_id: "provider-call", snapshot_id: "fixture-snapshot", snapshot_json: memory as Prisma.InputJsonValue } });
  const call = await prisma.call.create({ data: { account_id: accountId, provider: "telnyx", provider_call_id: "provider-call", direction: "inbound", status: "completed", from_number: value.phone, to_number: "+15555550188", started_at: now, transcript: "caller: Please arrange a ramp evaluation.", summary: value.summary, review_required: true } });
  callId = call.id;
});
afterAll(disconnectTestDb);

test("concurrent finalization creates one revision and approval has no external effects", async () => {
  const payload = { summary: value.summary, qualification: { status: "qualified" } };
  const rows = await Promise.all([queueCallReview(accountId, callId, payload), queueCallReview(accountId, callId, payload)]);
  expect(rows[0]?.id).toBe(rows[1]?.id);
  const row = rows[0]!;
  await decideCallReview(row.id, 1, "approve", value);
  expect(await prisma.crmSyncOperation.count({ where: { account_id: accountId } })).toBe(0);
  expect(await prisma.notification.count({ where: { account_id: accountId } })).toBe(0);
  await expect(decideCallReview(row.id, 1, "approve", value)).rejects.toThrow("stale_review");
});

test("late evidence creates a new review and invalidates an earlier approval request", async () => {
  const first = await queueCallReview(accountId, callId, { summary: value.summary });
  await prisma.call.update({ where: { id: callId }, data: { transcript: "caller: Correction, this is a service request." } });
  const second = await queueCallReview(accountId, callId, { summary: "Corrected request" });
  expect(second?.revision).toBe(2);
  expect((first?.evidence_json as { transcript: string }).transcript).toContain("ramp evaluation");
  await expect(decideCallReview(first!.id, 1, "approve", value)).rejects.toThrow("stale_review");
});

test("legacy retry entrypoints cannot bypass a supervised review", async () => {
  const crm = await runCrmSyncForCall({ accountId, callId, providerOverride: new MockCrmProvider() });
  expect(crm.ok && crm.data.status === "succeeded").toBe(false);
  const email = await dispatchCompletedInteractionNotification({ accountId, callId });
  expect(email).toMatchObject({ ok: false, error: { code: "approval_required" } });
});

test("a client cannot review another tenant's call", async () => {
  const row = await queueCallReview(accountId, callId, { summary: value.summary });
  setDevSession("client_admin@org_mock_1");
  await expect(decideCallReview(row!.id, 1, "approve", value)).rejects.toThrow();
});

test("capture requires the initialized tenant, consent and interval; withdrawal closes it", async () => {
  const event = { data: { id: "event", event_type: "call.conversation.ended", payload: { capture_started_at: new Date(now.getTime() + 1000).toISOString(), capture_ended_at: new Date(now.getTime() + 2000).toISOString() } } };
  expect(await canRetainCallContent(accountId, "provider-call", event)).toBe(false);
  await prisma.callConsentEvent.create({ data: { account_id: accountId, provider_call_id: "provider-call", event_key: "grant", action: "grant", artifact: "transcript", disclosure_ref: "fixture", evidence_ref: "fixture", actor_user_id: "test", occurred_at: now } });
  expect(await canRetainCallContent(accountId, "provider-call", event)).toBe(true);
  expect(await canRetainCallContent("other-account", "provider-call", event)).toBe(false);
  await prisma.callConsentEvent.create({ data: { account_id: accountId, provider_call_id: "provider-call", event_key: "withdraw", action: "withdraw", artifact: "transcript", disclosure_ref: "fixture", evidence_ref: "fixture", actor_user_id: "test", occurred_at: new Date(now.getTime() + 1500) } });
  expect(await canRetainCallContent(accountId, "provider-call", event)).toBe(false);
});
