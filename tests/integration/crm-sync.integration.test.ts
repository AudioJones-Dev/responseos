import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import { runCrmSyncForCall } from "@/lib/crm/syncFinalizedCall";
import { MockCrmProvider, type CrmProvider } from "@/lib/providers/crm";
import { disconnectTestDb, prisma, resetAndSeedTestDb } from "./setup";

describe("durable CRM synchronization", () => {
  beforeEach(resetAndSeedTestDb);
  afterAll(disconnectTestDb);

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
