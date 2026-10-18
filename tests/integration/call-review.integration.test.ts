import { afterAll, beforeEach, expect, test, vi } from "vitest";
import { EXECUTION_MODE_POLICIES } from "@/lib/agentExecution/policy";
import { Prisma } from "@prisma/client";
import { disconnectTestDb, prisma, resetAndSeedTestDb, setDevSession } from "./setup";
import { buildOperatingConfigurationSnapshot } from "@/lib/agentExecution/operatingConfigurationSnapshot";
import { canRetainCallContent } from "@/lib/callReview/consent";
import { decideCallReview, hasActiveDispatchClaim, queueCallReview, loadCallReviewConsole } from "@/lib/callReview/service";
import { runCrmSyncForCall, prepareCrmSyncRetry } from "@/lib/crm/syncFinalizedCall";
import { dispatchCompletedInteractionNotification } from "@/lib/notifications/completedInteraction";
import { MockCrmProvider } from "@/lib/providers/crm";
import * as crmProviders from "@/lib/providers/crm";
import * as emailProviders from "@/lib/providers/email";
import { ReviewPayloadSchema } from "@/lib/callReview/contracts";
import { recordWebhookEvent, findAgentTargetForProviderCall, findInitializedProviderCallId } from "@/lib/data/webhookEvents";

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

test.each(["operator", "aj_admin"])("%s approved dispatch reaches synthetic CRM and email sinks once", async role => {
  setDevSession(role);
  const previous = process.env.RESPONSEOS_AUTHORIZED_EXECUTION_GATES;
  process.env.RESPONSEOS_AUTHORIZED_EXECUTION_GATES = "v0.3-live-communications";
  await prisma.agentProfile.create({ data: { account_id: accountId, name: "Synthetic", type: "supervised_receptionist", slug: "route-synthetic", enabled: true, system_policy_json: JSON.parse(JSON.stringify(EXECUTION_MODE_POLICIES.SUPERVISED_PILOT)) } });
  const provider = new MockCrmProvider();
  Object.defineProperty(provider, "providerId", { value: "hubspot" });
  const create = vi.spyOn(provider, "createContact"), activity = vi.spyOn(provider, "createCallActivity"), task = vi.spyOn(provider, "createFollowUpTask");
  const send = vi.fn().mockResolvedValue({ providerMessageId: "synthetic-approved-message" });
  const crm = vi.spyOn(crmProviders, "getCrmProvider").mockReturnValue(provider);
  const email = vi.spyOn(emailProviders, "getEmailProvider").mockReturnValue({ providerId: "resend", send });
  try {
    const review = (await queueCallReview(accountId, callId, { summary: value.summary }))!;
    const route = await import("@/app/api/admin/call-reviews/[id]/route");
    const post = (body: unknown) => route.POST(new Request("http://localhost", { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ id: review.id }) });
    expect((await post({ action: "approve", revision: review.revision, payload: value })).status).toBe(200);
    expect((await post({ action: "dispatch" })).status).toBe(200);
    expect((await post({ action: "dispatch" })).status).toBe(200);
    for (const spy of [create, activity, task, send]) expect(spy).toHaveBeenCalledOnce();
    expect(await prisma.callReview.findUnique({ where: { id: review.id } })).toMatchObject({ crm_status: "succeeded", email_status: "accepted", email_message_id: "synthetic-approved-message", payload_json: value });
  } finally {
    crm.mockRestore(); email.mockRestore();
    if (previous === undefined) delete process.env.RESPONSEOS_AUTHORIZED_EXECUTION_GATES; else process.env.RESPONSEOS_AUTHORIZED_EXECUTION_GATES = previous;
  }
});

test.each([null, "client_admin@org_mock_1", "client_viewer@org_mock_1"])("review route denies %s for every action and conceals known/missing IDs", async role => {
  const review = (await queueCallReview(accountId, callId, { summary: value.summary }))!;
  const route = await import("@/app/api/admin/call-reviews/[id]/route");
  const previous = process.env.RESPONSEOS_REQUIRE_AUTH;
  try {
    if (role) setDevSession(role);
    else { delete process.env.RESPONSEOS_DEV_SESSION; process.env.RESPONSEOS_REQUIRE_AUTH = "true"; }
    const bodies = [
      { action: "approve", revision: 1, payload: value }, { action: "reject", revision: 1 },
      { action: "dispatch" }, { action: "crm_inspect" },
      { action: "crm_adopt", generation: 1, reason: "Synthetic resolution", evidence: "Synthetic evidence", priorWorkerStopped: true, expectedProviderId: "synthetic" },
      { action: "crm_abandon", generation: 1, reason: "Synthetic resolution", evidence: "Synthetic evidence" },
    ];
    for (const body of bodies) for (const id of [review.id, "missing-review"]) {
      const response = await route.POST(new Request("http://localhost", { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ error: { code: "operator_required" } });
    }
    expect(await prisma.callReview.findUnique({ where: { id: review.id } })).toMatchObject({ status: "pending", dispatch_at: null });
    expect(await prisma.crmSyncOperation.count()).toBe(0);
    expect(await prisma.notification.count()).toBe(0);
  } finally { if (previous === undefined) delete process.env.RESPONSEOS_REQUIRE_AUTH; else process.env.RESPONSEOS_REQUIRE_AUTH = previous; }
});

test.each(["operator", "aj_admin"])("review route permits %s approval and rejection, rejects tenant overrides", async role => {
  setDevSession(role);
  const review = (await queueCallReview(accountId, callId, { summary: value.summary }))!;
  const route = await import("@/app/api/admin/call-reviews/[id]/route");
  const post = (body: unknown) => route.POST(new Request("http://localhost", { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ id: review.id }) });
  expect((await post({ action: "approve", revision: 1, payload: value, accountId: "org_mock_1" })).status).toBe(422);
  expect((await post({ action: "approve", revision: 1, payload: value })).status).toBe(200);
  expect(await prisma.callReview.findUnique({ where: { id: review.id } })).toMatchObject({ status: "approved", payload_json: value });
  await prisma.call.update({ where: { id: callId }, data: { transcript: "Synthetic changed evidence" } });
  const second = (await queueCallReview(accountId, callId, { summary: "Synthetic revision" }))!;
  expect((await route.POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ action: "reject", revision: second.revision }) }), { params: Promise.resolve({ id: second.id }) })).status).toBe(200);
  expect(await prisma.callReview.findUnique({ where: { id: second.id } })).toMatchObject({ status: "rejected" });
  expect(await prisma.crmSyncOperation.count()).toBe(0);
  expect(await prisma.notification.count()).toBe(0);
});

test("signed initialization aliases recover both the tenant and canonical capture identity", async () => {
  await recordWebhookEvent({ account_id: accountId, provider: "telnyx", provider_event_id: "aliases", event_type: "assistant.initialization", verifiedBytes: Buffer.from(JSON.stringify({ data: { occurred_at: now.toISOString() } })), raw_body: JSON.stringify({ data: { occurred_at: now.toISOString() } }), signature_valid: true, provider_call_id: "provider-call", provider_call_ids: ["provider-call", "shared-session"], agent_target: "+15555550188" });
  expect(await findAgentTargetForProviderCall({ provider: "telnyx", providerCallIds: ["shared-session"] })).toBe("+15555550188");
  expect(await findInitializedProviderCallId({ provider: "telnyx", providerCallIds: ["shared-session"], target: "+15555550188" })).toBe("provider-call");
  expect(await findInitializedProviderCallId({ provider: "telnyx", providerCallIds: ["shared-session"], target: "+15555550189" })).toBeNull();
  await recordWebhookEvent({ account_id: "another-account", provider: "telnyx", provider_event_id: "other-leg", event_type: "assistant.initialization", verifiedBytes: Buffer.from("{}"), raw_body: "{}", signature_valid: true, provider_call_id: "other-control", provider_call_ids: ["shared-session"], agent_target: "+15555550189" });
  expect(await findAgentTargetForProviderCall({ provider: "telnyx", providerCallIds: ["shared-session"] })).toBeNull();
});

test("console limits calls after grouping revisions and loads each capture's consent", async () => {
  const row = (await queueCallReview(accountId, callId, { summary: value.summary }))!;
  await prisma.callReview.createMany({ data: Array.from({ length: 60 }, (_, index) => ({ account_id: accountId, call_id: "newer-call", revision: index + 1, source_hash: `hash-${index}`, evidence_json: {}, payload_json: {}, recipient: "owner@example.test", created_at: new Date(row.created_at.getTime() + index + 1) })) });
  await prisma.callConsentEvent.createMany({ data: Array.from({ length: 60 }, (_, index) => ({ account_id: accountId, provider_call_id: index ? "unrelated" : "provider-call", event_key: `event-${index}`, action: "grant", artifact: "transcript", disclosure_ref: "test", evidence_ref: "test", jurisdiction_basis: "test", source_channel: "call", actor_user_id: "operator", occurred_at: new Date(now.getTime() + index) })) });
  const consoleData = await loadCallReviewConsole();
  expect(consoleData.reviews.map((review) => review.id)).toContain(row.id);
  expect(consoleData.reviews.find((review) => review.call_id === "newer-call")?.revision).toBe(60);
  expect(consoleData.captures.find((capture) => capture.provider_call_id === "provider-call")?.consentAction).toBe("grant");
});

test("approved revisions cannot crowd a pending latest revision out of the console", async () => {
  const row = (await queueCallReview(accountId, callId, { summary: value.summary }))!;
  await prisma.callReview.createMany({ data: Array.from({ length: 60 }, (_, index) => ({ account_id: accountId, call_id: "approved-call", revision: index + 1, status: "approved" as const, source_hash: `approved-${index}`, evidence_json: {}, payload_json: {}, recipient: "owner@example.test", created_at: new Date(row.created_at.getTime() + index + 1) })) });
  const consoleData = await loadCallReviewConsole();
  expect(consoleData.reviews.map((review) => review.id)).toContain(row.id);
});

test.each(["pending", "succeeded"] as const)("live CRM cannot reuse a %s mock operation", async (status) => {
  await prisma.crmSyncOperation.create({ data: { account_id: accountId, call_id: callId, operation_key: `crm-call:${accountId}:${callId}`, provider: "mock", status } });
  const provider = new MockCrmProvider();
  const find = vi.spyOn(provider, "findContacts");
  expect(await runCrmSyncForCall({ accountId, callId, requireLiveProvider: true, providerOverride: provider })).toMatchObject({ ok: false, error: { code: "live_provider_reconciliation_required" } });
  expect(find).not.toHaveBeenCalled();
});

test("legacy retry directs supervised calls to their approved review", async () => {
  const operation = await prisma.crmSyncOperation.create({ data: { account_id: accountId, call_id: callId, operation_key: `crm-call:${accountId}:${callId}`, provider: "hubspot", status: "retryable_failed" } });
  expect(await prepareCrmSyncRetry({ id: operation.id, accountId })).toMatchObject({ ok: false, error: { code: "review_dispatch_required" } });
});

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

test("the pre-ack dispatch-claim check follows the claim's lifetime", async () => {
  const first = await queueCallReview(accountId, callId, { summary: value.summary });
  expect(await hasActiveDispatchClaim(accountId, "provider-call")).toBe(false);
  await prisma.callReview.update({ where: { id: first!.id }, data: { dispatch_at: new Date() } });
  expect(await hasActiveDispatchClaim(accountId, "provider-call")).toBe(true);
  expect(await hasActiveDispatchClaim("another-account", "provider-call")).toBe(false);
  await prisma.callReview.update({ where: { id: first!.id }, data: { dispatch_at: new Date(Date.now() - 16 * 60 * 1000) } });
  expect(await hasActiveDispatchClaim(accountId, "provider-call")).toBe(false);
});

test("late evidence cannot supersede a dispatch claim and can be retried after release", async () => {
  const first = await queueCallReview(accountId, callId, { summary: value.summary });
  await decideCallReview(first!.id, 1, "approve", value);
  await prisma.callReview.update({ where: { id: first!.id }, data: { dispatch_at: now } });
  await expect(queueCallReview(accountId, callId, { summary: "Corrected request" })).rejects.toThrow("review_dispatch_in_progress");
  expect(await prisma.callReview.count({ where: { account_id: accountId } })).toBe(1);
  await prisma.callReview.update({ where: { id: first!.id }, data: { dispatch_at: null } });
  expect((await queueCallReview(accountId, callId, { summary: "Corrected request" }))?.revision).toBe(2);
});

test("approved CRM retry releases an earlier claim and sanitizes the contact name", async () => {
  const provider = new MockCrmProvider();
  await runCrmSyncForCall({ accountId, callId, providerOverride: provider });
  const row = await queueCallReview(accountId, callId, { summary: value.summary });
  await decideCallReview(row!.id, 1, "approve", { ...value, caller: "Caller owner@example.test +15555550123" });
  vi.stubEnv("RESPONSEOS_AUTHORIZED_EXECUTION_GATES", "v0.3-live-communications");
  await prisma.agentProfile.create({ data: { account_id: accountId, name: "Test receptionist", type: "supervised_receptionist", slug: "crm-recovery-fixture", enabled: true, system_policy_json: EXECUTION_MODE_POLICIES.SUPERVISED_PILOT as unknown as Prisma.InputJsonValue } });
  const create = vi.spyOn(provider, "createContact");
  const result = await runCrmSyncForCall({ accountId, callId, reviewId: row!.id, providerOverride: provider });
  expect(result).toMatchObject({ ok: true, data: { status: "succeeded" } });
  expect(create).toHaveBeenCalledWith(expect.objectContaining({ firstName: "Caller [email redacted] [phone redacted]" }));
  vi.unstubAllEnvs();
});

test("legacy retry entrypoints cannot bypass a supervised review", async () => {
  const crm = await runCrmSyncForCall({ accountId, callId, providerOverride: new MockCrmProvider() });
  expect(crm.ok && crm.data.status === "succeeded").toBe(false);
  expect(await prisma.crmSyncOperation.findUnique({ where: { operation_key: `crm-call:${accountId}:${callId}` } }))
    .toMatchObject({ status: "retryable_failed", last_error_code: "crm_ready:contact_create" });
  const email = await dispatchCompletedInteractionNotification({ accountId, callId });
  expect(email).toMatchObject({ ok: false, error: { code: "approval_required" } });
});

test("a client cannot review another tenant's call", async () => {
  const row = await queueCallReview(accountId, callId, { summary: value.summary });
  setDevSession("client_admin@org_mock_1");
  await expect(decideCallReview(row!.id, 1, "approve", value)).rejects.toThrow();
});

test("capture requires the initialized tenant, consent and interval; withdrawal closes it", async () => {
  const event = { data: { id: "event", event_type: "call.conversation.ended", payload: { capture_started_at: new Date(now.getTime() - 20_000).toISOString(), capture_ended_at: new Date(now.getTime() - 19_000).toISOString() } } };
  expect(await canRetainCallContent(accountId, "provider-call", event)).toBe(false);
  await prisma.callConsentEvent.create({ data: { account_id: accountId, provider_call_id: "provider-call", event_key: "grant", action: "grant", artifact: "transcript", disclosure_ref: "fixture", evidence_ref: "fixture", jurisdiction_basis: "fixture", source_channel: "call", actor_user_id: "test", occurred_at: new Date(now.getTime() - 30_000) } });
  expect(await canRetainCallContent(accountId, "provider-call", event)).toBe(true);
  const futureEvent = { data: { ...event.data, payload: { ...event.data.payload, capture_ended_at: new Date(Date.now() + 60_000).toISOString() } } };
  expect(await canRetainCallContent(accountId, "provider-call", futureEvent)).toBe(false);
  expect(await canRetainCallContent("other-account", "provider-call", event)).toBe(false);
  await prisma.callConsentEvent.create({ data: { account_id: accountId, provider_call_id: "provider-call", event_key: "withdraw", action: "withdraw", artifact: "transcript", disclosure_ref: "fixture", evidence_ref: "fixture", jurisdiction_basis: "fixture", source_channel: "call", actor_user_id: "test", occurred_at: new Date(now.getTime() - 19_500) } });
  expect(await canRetainCallContent(accountId, "provider-call", event)).toBe(false);
});
