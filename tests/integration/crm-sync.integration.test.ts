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
});
