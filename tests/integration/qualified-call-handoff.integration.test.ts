import { afterAll, afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { syncFinalizedCallAndPrepareHandoff, runQualifiedCallHandoff } from "@/lib/crm/qualifiedCallHandoff";
import { MockCrmProvider } from "@/lib/providers/crm/mock";
import { syntheticHandoffSnapshot } from "../fixtures/qualifiedHandoffPolicy";
import { disconnectTestDb, prisma, resetAndSeedTestDb } from "./setup";

const accountId = "org_responseos_demo";
const callId = "call_responseos_demo";

describe("qualified FRL handoff on isolated Postgres", () => {
  beforeEach(async () => {
    await resetAndSeedTestDb();
    vi.stubEnv("RESPONSEOS_FRL_HANDOFF_ACCOUNT_ID", accountId);
    vi.stubEnv("RESPONSEOS_FRL_QUALIFIED_HANDOFF_ENABLED", "true");
    vi.stubEnv("RESPONSEOS_FRL_HANDOFF_SNAPSHOT_ID", "synthetic-snapshot");
    const snapshot = syntheticHandoffSnapshot(accountId);
    await prisma.businessMemorySnapshot.create({ data: {
      ...snapshot, memory_json: JSON.parse(JSON.stringify(snapshot.memory_json)),
      schema_version: "prospect-bootstrap.v1", version: 1, template_version: "synthetic-test",
    } });
  });
  afterEach(() => vi.unstubAllEnvs());
  afterAll(disconnectTestDb);

  test("captures contact and call, assigns one qualified task, queues one detailed notification", async () => {
    const provider = new MockCrmProvider();
    const task = vi.spyOn(provider, "createFollowUpTask");
    const params = { accountId, callId, providerOverride: provider };
    const first = await syncFinalizedCallAndPrepareHandoff(params);
    const again = await syncFinalizedCallAndPrepareHandoff(params);
    expect(first).toMatchObject({ ok: true, data: { crm: { status: "succeeded" }, handoff: { status: "queued", deliveryStatus: "not_sent" } } });
    expect(again).toMatchObject({ ok: true, data: { handoff: { attemptCount: 1 } } });
    expect(task).toHaveBeenCalledOnce();
    expect(task.mock.calls[0][0].ownerId).toBe("12345");
    expect(await prisma.qualifiedCallHandoff.count()).toBe(1);
    expect(await prisma.notification.count({ where: { dedupe_key: { not: null } } })).toBe(1);
    const notification = await prisma.notification.findFirstOrThrow({ where: { dedupe_key: { not: null } } });
    expect(notification.status).toBe("queued");
    expect(notification.sent_at).toBeNull();
    expect(notification.message).toContain("Callback:");
    expect(notification.message).toContain("Owned task:");
    expect(notification.message).not.toContain("recording_url");
    const crm = await prisma.crmSyncOperation.findFirstOrThrow({ where: { account_id: accountId } });
    expect(crm.provider_contact_id).toBeTruthy();
    expect(crm.provider_activity_id).toBeTruthy();
    expect(crm.provider_task_id).toBeNull();
  });

  test.each(["maybe", "unqualified", "spam"] as const)("%s call remains captured with zero notifications or owner tasks", async (status) => {
    const lead = await prisma.leadEvent.findFirstOrThrow({ where: { account_id: accountId, call_id: callId } });
    await prisma.leadQualification.update({ where: { lead_event_id: lead.id }, data: { qualification_status: status } });
    const provider = new MockCrmProvider();
    const task = vi.spyOn(provider, "createFollowUpTask");
    const result = await syncFinalizedCallAndPrepareHandoff({ accountId, callId, providerOverride: provider });
    expect(result).toMatchObject({ ok: true, data: { crm: { status: "succeeded" }, handoff: null } });
    expect(task).not.toHaveBeenCalled();
    expect(await prisma.qualifiedCallHandoff.count()).toBe(0);
    expect(await prisma.notification.count({ where: { dedupe_key: { not: null } } })).toBe(0);
  });

  test("real database claims prevent concurrent task and notification duplication", async () => {
    const provider = new MockCrmProvider();
    const task = vi.spyOn(provider, "createFollowUpTask");
    const params = { accountId, callId, providerOverride: provider };
    await syncFinalizedCallAndPrepareHandoff(params);
    await prisma.notification.deleteMany({ where: { dedupe_key: { not: null } } });
    await prisma.qualifiedCallHandoff.deleteMany();
    task.mockClear();
    await Promise.all([runQualifiedCallHandoff(params), runQualifiedCallHandoff(params), runQualifiedCallHandoff(params)]);
    expect(task).toHaveBeenCalledOnce();
    expect(await prisma.notification.count({ where: { dedupe_key: { not: null } } })).toBe(1);
    expect(await prisma.qualifiedCallHandoff.findFirstOrThrow()).toMatchObject({ status: "queued", attempt_count: 1 });
  });

  test("revoked config withholds handoff while CRM evidence remains persisted", async () => {
    await prisma.businessMemorySnapshot.update({ where: { id: "synthetic-snapshot", account_id: accountId }, data: { revoked_at: new Date() } });
    const provider = new MockCrmProvider();
    const task = vi.spyOn(provider, "createFollowUpTask");
    const result = await syncFinalizedCallAndPrepareHandoff({ accountId, callId, providerOverride: provider });
    expect(result).toMatchObject({ ok: true, data: { crm: { status: "succeeded" }, handoff: { status: "review_required" } } });
    expect(task).not.toHaveBeenCalled();
    expect(await prisma.notification.count({ where: { dedupe_key: { not: null } } })).toBe(0);
  });

  test("another tenant's call cannot be read or notified", async () => {
    const provider = new MockCrmProvider();
    const task = vi.spyOn(provider, "createFollowUpTask");
    await prisma.call.update({ where: { id: callId }, data: { account_id: "other-synthetic-tenant" } });
    expect(await runQualifiedCallHandoff({ accountId, callId, providerOverride: provider })).toEqual({ ok: true, data: null });
    expect(task).not.toHaveBeenCalled();
    expect(await prisma.qualifiedCallHandoff.count()).toBe(0);
  });
});
