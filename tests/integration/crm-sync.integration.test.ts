import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import { runCrmSyncForCall } from "@/lib/crm/syncFinalizedCall";
import { MockCrmProvider, type CrmProvider } from "@/lib/providers/crm";
import { disconnectTestDb, prisma, resetAndSeedTestDb } from "./setup";

describe("durable CRM synchronization", () => {
  beforeEach(resetAndSeedTestDb);
  afterAll(disconnectTestDb);

  test("concurrent retries claim one operation before provider effects", async () => {
    const provider = new MockCrmProvider();
    const contact = vi.spyOn(provider, "createContact");
    const activity = vi.spyOn(provider, "createCallActivity");
    const task = vi.spyOn(provider, "createFollowUpTask");
    await prisma.crmSyncOperation.create({ data: {
      account_id: "org_responseos_demo", call_id: "call_responseos_demo",
      operation_key: "crm-call:org_responseos_demo:call_responseos_demo",
      provider: "mock", status: "retryable_failed",
    } });
    const params = { accountId: "org_responseos_demo", callId: "call_responseos_demo", providerOverride: provider };
    const results = await Promise.all([runCrmSyncForCall(params), runCrmSyncForCall(params)]);
    expect(results.every((result) => result.ok)).toBe(true);
    expect(contact).toHaveBeenCalledOnce();
    expect(activity).toHaveBeenCalledOnce();
    expect(task).toHaveBeenCalledOnce();
    expect(await prisma.crmSyncOperation.findFirstOrThrow()).toMatchObject({ status: "succeeded", attempt_count: 1 });
  });

  test("replays one finalized qualified call without duplicate operations", async () => {
    const params = {
      accountId: "org_responseos_demo",
      callId: "call_responseos_demo",
      providerOverride: new MockCrmProvider(),
    };
    const first = await runCrmSyncForCall(params);
    const replay = await runCrmSyncForCall(params);
    expect(first.ok && first.data.status).toBe("succeeded");
    expect(replay.ok && replay.data.operation_key).toBe(first.ok ? first.data.operation_key : "");
    expect(await prisma.crmSyncOperation.count()).toBe(1);
    const operation = await prisma.crmSyncOperation.findFirstOrThrow();
    expect(operation.provider_contact_id).toBeTruthy();
    expect(operation.provider_activity_id).toBeTruthy();
    expect(operation.provider_task_id).toBeTruthy();
  });

  test("redacts contact details from the next action sent to the CRM", async () => {
    const provider = new MockCrmProvider();
    const activity = vi.spyOn(provider, "createCallActivity");
    const task = vi.spyOn(provider, "createFollowUpTask");
    await prisma.leadEvent.updateMany({
      where: { account_id: "org_responseos_demo", call_id: "call_responseos_demo" },
      data: { notes: "Call sam@example.com at +1 (786) 555-0100 tomorrow." },
    });
    const result = await runCrmSyncForCall({
      accountId: "org_responseos_demo",
      callId: "call_responseos_demo",
      providerOverride: provider,
    });
    expect(result.ok && result.data.status).toBe("succeeded");
    const expected = "Call [email redacted] at [phone redacted] tomorrow.";
    expect(activity.mock.calls[0]?.[0].nextAction).toBe(expected);
    expect(task.mock.calls[0]?.[0].nextAction).toBe(expected);
  });

  test("marks ambiguous contact matches for review without mutation", async () => {
    const provider = new MockCrmProvider();
    provider.findContacts = vi.fn().mockResolvedValue([
      { providerContactId: "contact-1" },
      { providerContactId: "contact-2" },
    ]);
    provider.createContact = vi.fn();
    provider.createCallActivity = vi.fn();
    const result = await runCrmSyncForCall({
      accountId: "org_responseos_demo",
      callId: "call_responseos_demo",
      providerOverride: provider as CrmProvider,
    });
    expect(result.ok && result.data.status).toBe("review_required");
    expect(provider.createContact).not.toHaveBeenCalled();
    expect(provider.createCallActivity).not.toHaveBeenCalled();
  });

  test("cancels instead of syncing a call whose content was purged", async () => {
    await prisma.call.update({
      where: { id: "call_responseos_demo" },
      data: { from_number: "<PURGED>", contact_id: null, transcript: null, summary: null },
    });
    await prisma.crmSyncOperation.create({ data: {
      account_id: "org_responseos_demo", call_id: "call_responseos_demo",
      operation_key: "crm-call:org_responseos_demo:call_responseos_demo",
      provider: "mock", status: "retryable_failed",
    } });
    const provider = new MockCrmProvider();
    const find = vi.spyOn(provider, "findContacts");
    const result = await runCrmSyncForCall({
      accountId: "org_responseos_demo",
      callId: "call_responseos_demo",
      providerOverride: provider,
    });
    expect(result.ok && result.data.status).toBe("cancelled");
    expect(find).not.toHaveBeenCalled();
    expect(await prisma.crmSyncOperation.findFirstOrThrow()).toMatchObject({
      status: "cancelled", last_error_code: "retention_purged", next_attempt_at: null,
    });
  });
});
