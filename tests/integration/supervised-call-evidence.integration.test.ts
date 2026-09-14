import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { normalizeTelnyxEvent } from "@/lib/providers/telnyx/normalize";
import { recordWebhookEvent } from "@/lib/data/webhookEvents";
import type { TelnyxWebhookEnvelope } from "@/lib/providers/telnyx/webhook";
import { buildOperatingConfigurationSnapshot } from "@/lib/agentExecution/operatingConfigurationSnapshot";
import {
  dispatchCompletedInteractionNotification,
  retryCompletedInteractionNotification,
} from "@/lib/notifications/completedInteraction";
import { runCrmSyncForCall } from "@/lib/crm/syncFinalizedCall";
import { MockCrmProvider } from "@/lib/providers/crm";
import type { EmailMessage, EmailProvider } from "@/lib/providers/email";
import { disconnectTestDb, prisma, resetAndSeedTestDb, setDevSession } from "./setup";

const ACCOUNT_SLUG = "example-supervised-evidence";
const TENANT_NUMBER = "+15555550188";
const CALLER_NUMBER = "+15555550147";
const RECIPIENT = "owner@example.test";
const now = new Date("2026-09-11T15:00:00.000Z");

class StubEmailProvider implements EmailProvider {
  readonly providerId = "resend" as const;
  readonly sent: EmailMessage[] = [];
  constructor(private readonly failWith?: string) {}
  async send(message: EmailMessage) {
    if (this.failWith) throw new Error(this.failWith);
    this.sent.push(message);
    return { providerMessageId: `stub-${this.sent.length}` };
  }
}

const CONFIGURATION = [
  { key: "operating_hours.weekly", value: { type: "always_open" } },
  { key: "operating_hours.holidays", value: { type: "always_open" } },
  {
    key: "service_area.coverage",
    value: {
      regions: ["Example Region"],
      precision: "broad_region",
      countyInferenceAllowed: false,
      locationConfirmationRequired: true,
      collectFromCaller: ["city", "postal_code"],
    },
  },
  { key: "contact.escalation.primary", value: { name: "Example Owner", phone: "+15555550123" } },
  {
    key: "policy.consent",
    value: {
      aiDisclosure: "This call is handled by an automated assistant.",
      transcription: { enabled: true },
      recording: { enabled: false },
      refusal: {
        acknowledgement: "Understood.",
        stopRecordingWhenSupported: true,
        offer: "transfer_or_callback",
        minimizeCollection: true,
      },
    },
  },
  {
    key: "notification.completed_interaction.recipient",
    value: {
      channel: "email",
      recipient: RECIPIENT,
      event: "completed_interaction",
      enabled: true,
      temporary: true,
    },
  },
];

const INSIGHT = {
  caller: { first_name: "Dana", last_name: "Rivera", city: "Example City", state: "FL", postal_code: "00000" },
  caller_relationship: "NEW_PROSPECT",
  interaction_class: "NEW_SALES",
  service_requested: "Modular ramp",
  quote_requested: true,
  photos_requested: true,
  recording_consent: "continued",
  next_action: "Call back on 555-555-0147 to confirm measurements.",
  qualification: { status: "qualified", score: 91, service_area_match: true },
};

async function createTenant() {
  const account = await prisma.account.create({
    data: {
      name: "Example Business",
      slug: ACCOUNT_SLUG,
      industry: "home-services",
      timezone: "America/New_York",
      status: "active",
    },
  });
  const built = buildOperatingConfigurationSnapshot({
    accountId: account.id,
    generatedAt: now,
    entries: CONFIGURATION,
    assertion: {
      sourceId: `operator-configuration:${account.id}`,
      recordRef: "approval-record:integration",
      contentHash: "c".repeat(64),
      assertedBy: "user_aj_operator_1",
      assertedAt: now,
    },
  });
  await prisma.businessMemorySnapshot.create({
    data: {
      account_id: account.id,
      bootstrap_id: null,
      schema_version: built.memory.schemaVersion,
      version: 1,
      memory_json: built.memory as never,
      content_hash: built.hash,
      template_version: "SUPERVISED_PILOT",
      status: "approved",
      approved_by: "user_aj_operator_1",
      approved_at: now,
    },
  });
  return account;
}

async function ledger(event: TelnyxWebhookEnvelope, accountId: string) {
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

function insightEvent(id: string): TelnyxWebhookEnvelope {
  return {
    data: {
      id,
      event_type: "call.conversation_insights.generated",
      occurred_at: now.toISOString(),
      payload: {
        call_control_id: "call-supervised-1",
        from: CALLER_NUMBER,
        to: TENANT_NUMBER,
        duration_sec: 214,
        message_history: [
          { role: "assistant", content: "Thanks for calling Example Business." },
          { role: "user", content: "I need a ramp quote." },
        ],
        results: [
          { insight_id: "summary", result: "Caller asked for a modular ramp quote and will email photos." },
          { insight_id: "responseos", result: JSON.stringify(INSIGHT) },
        ],
      },
    },
  };
}

async function normalize(account: { id: string }, eventId: string) {
  const event = insightEvent(eventId);
  return normalizeTelnyxEvent({
    accountId: account.id,
    demoNumber: TENANT_NUMBER,
    webhookEventId: await ledger(event, account.id),
    event,
    options: { captureCallerIdentity: true, createQuoteRequest: true },
  });
}

describe("supervised call evidence", () => {
  beforeEach(async () => {
    await resetAndSeedTestDb();
    setDevSession("operator");
  });
  afterAll(disconnectTestDb);

  test("records the caller, the classification, the transcript, and one quote request", async () => {
    const account = await createTenant();
    const normalized = await normalize(account, "event-1");
    expect(normalized.finalized).toBe(true);

    const call = await prisma.call.findFirstOrThrow({ where: { account_id: account.id } });
    expect(call).toMatchObject({
      status: "completed",
      from_number: CALLER_NUMBER,
      duration_seconds: 214,
      caller_relationship: "new_prospect",
      interaction_class: "new_sales",
      recording_consent: "continued",
    });
    expect(call.summary).toContain("modular ramp quote");

    const contact = await prisma.contact.findFirstOrThrow({ where: { account_id: account.id } });
    expect(contact).toMatchObject({ first_name: "Dana", last_name: "Rivera", city: "Example City", zip: "00000" });

    const transcript = await prisma.callTranscript.findUniqueOrThrow({ where: { call_id: call.id } });
    expect(transcript.inline_text).toContain("user: I need a ramp quote.");
    expect(transcript.expires_at).toBeNull();

    const quote = await prisma.quoteRequest.findFirstOrThrow({ where: { account_id: account.id } });
    expect(quote).toMatchObject({ service_type: "Modular ramp", photos_requested: true, property_address: "Example City, FL, 00000" });
  });

  test("a replayed event updates the same rows instead of duplicating them", async () => {
    const account = await createTenant();
    await normalize(account, "event-1");
    await normalize(account, "event-2");

    expect(await prisma.call.count({ where: { account_id: account.id } })).toBe(1);
    expect(await prisma.contact.count({ where: { account_id: account.id } })).toBe(1);
    expect(await prisma.leadEvent.count({ where: { account_id: account.id } })).toBe(1);
    expect(await prisma.quoteRequest.count({ where: { account_id: account.id } })).toBe(1);
  });

  test("never overwrites a caller name the agent did not confirm", async () => {
    const account = await createTenant();
    await prisma.contact.create({
      data: { account_id: account.id, phone: CALLER_NUMBER, first_name: "Existing", last_name: "Name", source: "manual" },
    });
    await normalize(account, "event-1");
    const contact = await prisma.contact.findFirstOrThrow({ where: { account_id: account.id } });
    expect(contact).toMatchObject({ first_name: "Existing", last_name: "Name" });
  });

  test("fails the CRM write visibly rather than reporting a mock success", async () => {
    const account = await createTenant();
    const normalized = await normalize(account, "event-1");
    const result = await runCrmSyncForCall({
      accountId: account.id,
      callId: normalized.callId!,
      requireLiveProvider: true,
      structuredActivity: true,
      providerOverride: new MockCrmProvider(),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({ status: "retryable_failed", last_error_code: "live_provider_disabled" });
  });

  test("creates a follow-up task for a quote request and sanitizes the next action", async () => {
    const account = await createTenant();
    const normalized = await normalize(account, "event-1");
    const provider = new MockCrmProvider();
    const result = await runCrmSyncForCall({
      accountId: account.id,
      callId: normalized.callId!,
      structuredActivity: true,
      providerOverride: provider,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.status).toBe("succeeded");
    expect(result.data.provider_task_id).toBeTruthy();

    const lead = await prisma.leadEvent.findFirstOrThrow({ where: { account_id: account.id } });
    expect(lead.notes).toContain("555-555-0147");
    // The stored note keeps the caller's number; what reaches the CRM does not.
    const activity = await prisma.crmSyncOperation.findFirstOrThrow({ where: { account_id: account.id } });
    expect(activity.provider_activity_id).toBeTruthy();
  });

  test("marks the notification failed when the live email provider is required but absent", async () => {
    const account = await createTenant();
    const normalized = await normalize(account, "event-1");
    const result = await dispatchCompletedInteractionNotification({
      accountId: account.id,
      callId: normalized.callId!,
      requireLiveProvider: true,
      now,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({ status: "failed", reason: "live_provider_disabled" });

    const notification = await prisma.notification.findFirstOrThrow({ where: { account_id: account.id } });
    expect(notification).toMatchObject({
      channel: "email",
      recipient: RECIPIENT,
      event: "completed_interaction",
      status: "failed",
      last_error_code: "live_provider_disabled",
    });
    expect(notification.subject).toBe("New Sales Enquiry — Dana Rivera | Example Business");
    expect(notification.message).not.toContain("I need a ramp quote");
    expect(notification.message).not.toContain("+15555550123");
  });

  test("retries the frozen payload after configuration revocation while preserving the live-provider gate", async () => {
    const account = await createTenant();
    const normalized = await normalize(account, "event-1");
    await dispatchCompletedInteractionNotification({
      accountId: account.id,
      callId: normalized.callId!,
      requireLiveProvider: true,
      now,
    });
    const failed = await prisma.notification.findFirstOrThrow({ where: { account_id: account.id } });

    await prisma.businessMemorySnapshot.updateMany({ where: { account_id: account.id }, data: { status: "revoked" } });
    await prisma.notification.update({ where: { id: failed.id }, data: { provider: "resend", last_error_code: "email_request_failed" } });
    const disabledRetry = await retryCompletedInteractionNotification({ id: failed.id, now });
    expect(disabledRetry).toMatchObject({ ok: true, data: { status: "failed", reason: "live_provider_disabled" } });
    const provider = new StubEmailProvider();
    const retried = await retryCompletedInteractionNotification({ id: failed.id, providerOverride: provider, now });
    expect(retried.ok).toBe(true);
    if (!retried.ok) return;
    expect(retried.data.status).toBe("sent");
    expect(provider.sent).toHaveLength(1);
    expect(provider.sent[0]).toMatchObject({
      to: RECIPIENT,
      subject: failed.subject!,
      text: failed.message,
      idempotencyKey: `completed_interaction:${account.id}:${normalized.callId}`,
    });

    const again = await dispatchCompletedInteractionNotification({
      accountId: account.id,
      callId: normalized.callId!,
      providerOverride: provider,
      now,
    });
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.data).toMatchObject({ status: "skipped", reason: "already_sent" });
    expect(provider.sent).toHaveLength(1);
    expect(await prisma.notification.count({ where: { account_id: account.id } })).toBe(1);
  });

  test("records a provider failure as retryable without a second row", async () => {
    const account = await createTenant();
    const normalized = await normalize(account, "event-1");
    const result = await dispatchCompletedInteractionNotification({
      accountId: account.id,
      callId: normalized.callId!,
      providerOverride: new StubEmailProvider("email_http_429_rate_limit_exceeded"),
      now,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.status).toBe("failed");

    const notification = await prisma.notification.findFirstOrThrow({ where: { account_id: account.id } });
    expect(notification.last_error_code).toBe("email_http_429_rate_limit_exceeded");
    expect(notification.attempt_count).toBe(1);
    expect(notification.next_attempt_at).not.toBeNull();
  });

  test("skips quietly when the tenant configured no recipient", async () => {
    const account = await prisma.account.create({
      data: { name: "No Recipient", slug: "no-recipient", industry: "home-services", timezone: "America/New_York" },
    });
    const normalized = await normalize(account, "event-1");
    const result = await dispatchCompletedInteractionNotification({
      accountId: account.id,
      callId: normalized.callId!,
      now,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({ status: "skipped", reason: "recipient_not_configured" });
    expect(await prisma.notification.count({ where: { account_id: account.id } })).toBe(0);
  });
});
