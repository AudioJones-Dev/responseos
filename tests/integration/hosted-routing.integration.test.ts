import { afterAll, beforeEach, expect, test } from "vitest";
import { PrismaClient } from "@prisma/client";
import { prisma, resetAndSeedTestDb, disconnectTestDb } from "./setup";
import { authority, payload, submissionId } from "../routingFixtures";
import { persistHostedIntake, claimDelivery, settleDelivery, saveCheckpoint, deliveryStatus, reconcileSimulatedDelivery } from "@/lib/routing/ledger";
import { executeClaim, runWorkerBatch } from "@/lib/routing/worker";
import { SimulatedRoutingProvider } from "@/lib/routing/simulatedProvider";
import { ProviderFailure } from "@/lib/routing/provider";
import { purgeExpiredFrlWebIntakePayloads } from "@/lib/data/frlWebIntakes";
import manifest from "@/docs/routing/frl-hubspot-manifest.json";

beforeEach(async () => { process.env.RESPONSEOS_DEV_SESSION = "aj_admin"; await resetAndSeedTestDb(); });
afterAll(disconnectTestDb);
test("confirmed replay keeps its receipt when provider configuration becomes unavailable; new intake fails closed", async () => {
  const receipt = await persistHostedIntake(prisma, authority, submissionId, payload());
  await runWorkerBatch(prisma, authority.accountId, "test", new SimulatedRoutingProvider(), 1);
  manifest.requiredCustomProperties.deals.push("missing_provider_field");
  try {
    expect(await persistHostedIntake(prisma, authority, submissionId, payload())).toMatchObject({reference: receipt.reference, replay: true, deliveryStatus: "confirmed"});
    const secondId = "00000000-0000-4000-8000-000000000002";
    await expect(persistHostedIntake(prisma, authority, secondId, payload("residential", secondId))).rejects.toThrow("provider_properties_inconsistent");
    expect(await prisma.frlWebIntake.count()).toBe(1);
  } finally {manifest.requiredCustomProperties.deals.pop();}
});
test("concurrent identical persistence returns one receipt and one durable intent", async () => {
  const results = await Promise.all(Array.from({length: 8}, () => persistHostedIntake(prisma, authority, submissionId, payload())));
  expect(new Set(results.map(r => r.reference)).size).toBe(1);
  expect(results.filter(r => !r.replay)).toHaveLength(1);
  expect(await prisma.$queryRaw`SELECT id FROM "HostedRoutingDelivery"`).toHaveLength(1);
  const audit = await prisma.auditLog.findFirstOrThrow({where: {action: "hosted_routing.received"}});
  expect(audit.after_ref).toMatchObject({keyId: authority.keyId, environment: "test", audience: authority.audience});
  expect(JSON.stringify(audit.after_ref)).not.toContain("synthetic@example.invalid");
  await expect(persistHostedIntake(prisma, authority, submissionId, {...payload(), inquiry: {...payload().inquiry, summary: "changed"}})).rejects.toMatchObject({status: 409});
});
test("caller tenant, extra image data, wrong identity and tenant absence fail without persistence", async () => {
  for (const input of [{...payload(), accountId: "other"}, {...payload(), inquiry: {...payload().inquiry, accountId: "other"}}, {...payload(), inquiry: {...payload().inquiry, imageReferences: ["private"]}}]) await expect(persistHostedIntake(prisma, authority, submissionId, input)).rejects.toMatchObject({status: 400});
  await expect(persistHostedIntake(prisma, {...authority, accountId: "missing"}, submissionId, payload())).rejects.toMatchObject({status: 403});
  expect(await prisma.frlWebIntake.count()).toBe(0);
});
test("separate tenants and environments preserve independent receipts", async () => {
  const one = await persistHostedIntake(prisma, authority, submissionId, payload());
  const two = await persistHostedIntake(prisma, {...authority, accountId: "org_mock_2"}, submissionId, payload());
  const three = await persistHostedIntake(prisma, {...authority, environment: "preview"}, submissionId, payload());
  expect(new Set([one.reference, two.reference, three.reference]).size).toBe(3);
  expect(await deliveryStatus(prisma, "org_mock_2", one.reference)).toBeNull();
});
test("competing database clients claim one fence; expired lease quarantines once", async () => {
  await persistHostedIntake(prisma, authority, submissionId, payload());
  const second = new PrismaClient();
  try {
    const claims = await Promise.all([claimDelivery(prisma, authority.accountId, "test"), claimDelivery(second, authority.accountId, "test")]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    const claim = claims.find(Boolean)!;
    await prisma.$executeRaw`UPDATE "HostedRoutingDelivery" SET lease_until = NOW() - INTERVAL '1 second' WHERE id = ${claim.id}`;
    expect(await claimDelivery(second, authority.accountId, "test")).toBeNull();
    expect(await claimDelivery(second, authority.accountId, "test")).toBeNull();
    await expect(settleDelivery(prisma, claim, "confirmed", "stale_worker")).rejects.toThrow("dispatch_fence_lost");
    const status = await deliveryStatus(prisma, authority.accountId, claim.reference);
    expect(status?.status).toBe("uncertain");
    expect(await prisma.auditLog.count({where: {action: "hosted_routing.uncertain"}})).toBe(1);
  } finally { await second.$disconnect(); }
});
test.each(["residential", "builder", "architect", "commercial", "repair", "equipment_acquisition"] as const)("durably simulates %s with confirmed replay after new client", async pathway => {
  const receipt = await persistHostedIntake(prisma, authority, submissionId, payload(pathway));
  expect(await runWorkerBatch(prisma, authority.accountId, "test", new SimulatedRoutingProvider())).toContain("confirmed");
  const restarted = new PrismaClient();
  try {
    const replay = await persistHostedIntake(restarted, authority, submissionId, payload(pathway));
    expect(replay).toMatchObject({reference: receipt.reference, deliveryStatus: "confirmed", mode: "simulated", replay: true});
    expect(await claimDelivery(restarted, authority.accountId, "test")).toBeNull();
  } finally { await restarted.$disconnect(); }
});
test("lost contact acknowledgement stays uncertain and does not retry", async () => {
  const receipt = await persistHostedIntake(prisma, authority, submissionId, payload());
  class LostAck extends SimulatedRoutingProvider { async createContact(): Promise<never> {throw new Error("response_lost");} }
  expect(await runWorkerBatch(prisma, authority.accountId, "test", new LostAck(), 1)).toEqual(["uncertain"]);
  expect(await claimDelivery(prisma, authority.accountId, "test")).toBeNull();
  expect((await deliveryStatus(prisma, authority.accountId, receipt.reference))?.status).toBe("uncertain");
});
test("definitive nonacceptance retries with bounded backoff; no inflight uncertainty is cleared blindly", async () => {
  await persistHostedIntake(prisma, authority, submissionId, payload());
  class RateLimited extends SimulatedRoutingProvider { async createContact(): Promise<never> {throw new ProviderFailure("hubspot_http_429", "retry");} }
  const claim = (await claimDelivery(prisma, authority.accountId, "test"))!;
  expect(await executeClaim(prisma, claim, new RateLimited())).toBe("queued");
  expect(await claimDelivery(prisma, authority.accountId, "test")).toBeNull();
  await prisma.$executeRaw`UPDATE "HostedRoutingDelivery" SET next_attempt_at = NOW() - INTERVAL '1 second' WHERE id = ${claim.id}`;
  const retry = (await claimDelivery(prisma, authority.accountId, "test"))!;
  expect(retry.attempt_count).toBe(2);
  expect(retry.checkpoint_json.inFlight).toBeUndefined();
});
test("partial association and unresolved checkpoint cannot blindly resume", async () => {
  await persistHostedIntake(prisma, authority, submissionId, payload());
  const claim = (await claimDelivery(prisma, authority.accountId, "test"))!;
  await saveCheckpoint(prisma, claim, {...claim.checkpoint_json, contactId: "123", inFlight: "inquiry"});
  claim.checkpoint_json = {...claim.checkpoint_json, contactId: "123", inFlight: "inquiry"};
  expect(await executeClaim(prisma, claim, new SimulatedRoutingProvider())).toBe("uncertain");
});
test("operator reconciliation is tenant-bound, audited and simulation-only", async () => {
  const receipt = await persistHostedIntake(prisma, authority, submissionId, payload());
  const claim = (await claimDelivery(prisma, authority.accountId, "test"))!;
  await settleDelivery(prisma, claim, "uncertain", "test_loss");
  await expect(reconcileSimulatedDelivery(prisma, "org_mock_2", receipt.reference, "user_mock_admin", "not_accepted", "test-proof")).rejects.toThrow("reconciliation_refused");
  expect(await reconcileSimulatedDelivery(prisma, authority.accountId, receipt.reference, "user_mock_admin", "not_accepted", "test-proof")).toBe("rejected");
  expect(await prisma.auditLog.count({where: {action: "hosted_routing.reconciled", account_id: authority.accountId}})).toBe(1);
  expect(await claimDelivery(prisma, authority.accountId, "test")).toBeNull();
});
test("expired unresolved payloads are retained under the tenant lock", async () => {
  process.env.RESPONSEOS_DEV_SESSION = "client_admin@org_mock_1";
  await persistHostedIntake(prisma, authority, submissionId, payload());
  await prisma.frlWebIntake.updateMany({data: {expires_at: new Date(Date.now() - 1000)}});
  await purgeExpiredFrlWebIntakePayloads();
  expect((await prisma.frlWebIntake.findFirst())?.request_json).not.toBeNull();
});
test("SQL refuses live-like inconsistent fences and cross-tenant delivery linkage", async () => {
  await persistHostedIntake(prisma, authority, submissionId, payload());
  await expect(prisma.$executeRaw`UPDATE "HostedRoutingDelivery" SET status = 'dispatching'`).rejects.toThrow();
  await expect(prisma.$executeRaw`UPDATE "HostedRoutingDelivery" SET account_id = 'org_mock_2'`).rejects.toThrow();
});
test("changed private payload is quarantined before dispatch", async () => {
  await persistHostedIntake(prisma, authority, submissionId, payload());
  const claim = (await claimDelivery(prisma, authority.accountId, "test"))!;
  claim.request_json.inquiry.summary = "tampered";
  expect(await executeClaim(prisma, claim, new SimulatedRoutingProvider())).toBe("uncertain");
  expect((await deliveryStatus(prisma, authority.accountId, claim.reference))?.last_error_code).toBe("payload_integrity_failed");
});
test("changed routing plan is quarantined before any provider call", async () => {
  await persistHostedIntake(prisma, authority, submissionId, payload());
  const claim = (await claimDelivery(prisma, authority.accountId, "test"))!;
  claim.checkpoint_json.planFingerprint = "0".repeat(64);
  class MustNotCall extends SimulatedRoutingProvider {async findContact(): Promise<never> {throw new Error("unexpected_provider_call");}}
  expect(await executeClaim(prisma, claim, new MustNotCall())).toBe("uncertain");
  expect((await deliveryStatus(prisma, authority.accountId, claim.reference))?.last_error_code).toBe("routing_plan_changed");
});
test("association readback failure after acceptance is uncertain", async () => {
  await persistHostedIntake(prisma, authority, submissionId, payload());
  class FailedReadback extends SimulatedRoutingProvider { async verifyAssociation(): Promise<never> {throw new ProviderFailure("read_timeout", "retry");} }
  expect(await runWorkerBatch(prisma, authority.accountId, "test", new FailedReadback(), 1)).toEqual(["uncertain"]);
  expect(await claimDelivery(prisma, authority.accountId, "test")).toBeNull();
});
