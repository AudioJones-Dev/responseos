import {afterAll, beforeEach, expect, test} from "vitest";
import {prisma, resetAndSeedTestDb, disconnectTestDb} from "./setup";
import {authority, payload, submissionId} from "../routingFixtures";
import {persistHostedIntake, claimDelivery, queueStalledRoutingNotices} from "@/lib/routing/ledger";
import {runWorkerBatch} from "@/lib/routing/worker";
import {SimulatedRoutingProvider} from "@/lib/routing/simulatedProvider";
import {ProviderFailure} from "@/lib/routing/provider";
import type {Plan} from "@/lib/routing/frlPlan";
const binding = {accountId: authority.accountId, environment: "test" as const, portalId: "247150421", companyId: "123", approvalReference: "synthetic-approval"};
beforeEach(resetAndSeedTestDb);
afterAll(disconnectTestDb);
test("Company requires server approval before any mutation and all activity associations are checkpointed", async () => {
 const body = payload(); Object.assign(body.inquiry, {company: {id: "123", verified: true}});
 await persistHostedIntake(prisma, authority, submissionId, body);
 expect(await runWorkerBatch(prisma, authority.accountId, "test", new SimulatedRoutingProvider(), 1, [binding])).toEqual(["confirmed"]);
 const row = await prisma.hostedRoutingDelivery.findFirstOrThrow();
 expect(row.checkpoint_json).toMatchObject({companyId: "123", companyApprovalReference: "synthetic-approval"});
 expect((row.checkpoint_json as {edges: string[]}).edges).toHaveLength(8);
 const secondId = "00000000-0000-4000-8000-000000000002";
 const other = payload("residential", secondId); Object.assign(other.inquiry, {company: {id: "123", verified: true}});
 await persistHostedIntake(prisma, {...authority, accountId: "org_mock_2"}, secondId, other);
 class NoMutation extends SimulatedRoutingProvider {async createContact(): Promise<never> {throw new Error("must_not_mutate");}}
 expect(await runWorkerBatch(prisma, "org_mock_2", "test", new NoMutation(), 1, [binding])).toEqual(["rejected"]);
});
test("lost Task acknowledgement quarantines with no automatic retry", async () => {
 await persistHostedIntake(prisma, authority, submissionId, payload());
 class LostTask extends SimulatedRoutingProvider {async createActivity(plan: Plan, type: "notes" | "tasks") {if (type === "tasks") throw new Error("lost_ack"); return super.createActivity(plan, type);}}
 expect(await runWorkerBatch(prisma, authority.accountId, "test", new LostTask(), 1)).toEqual(["uncertain"]);
 expect(await claimDelivery(prisma, authority.accountId, "test")).toBeNull();
 expect((await prisma.hostedRoutingDelivery.findFirstOrThrow()).checkpoint_json).toMatchObject({inFlight: "task"});
});
test("definitive late refusal resumes persisted activity identities without recreating them", async () => {
 await persistHostedIntake(prisma, authority, submissionId, payload());
 class RetryEdge extends SimulatedRoutingProvider {
  counts = {notes: 0, tasks: 0}; calls = 0;
  async createActivity(plan: Plan, type: "notes" | "tasks") {this.counts[type]++; return super.createActivity(plan, type);}
  async associateObjects() {if (++this.calls === 3) throw new ProviderFailure("hubspot_http_429", "retry");}
 }
 const provider = new RetryEdge();
 expect(await runWorkerBatch(prisma, authority.accountId, "test", provider, 1)).toEqual(["queued"]);
 await prisma.$executeRaw`UPDATE "HostedRoutingDelivery" SET next_attempt_at = NOW() - INTERVAL '1 second' WHERE account_id = ${authority.accountId}`;
 expect(await runWorkerBatch(prisma, authority.accountId, "test", provider, 1)).toEqual(["confirmed"]);
 expect(provider.counts).toEqual({notes: 1, tasks: 1});
});
test("replays and repeated stalled scans queue one redacted internal notice per event", async () => {
 await persistHostedIntake(prisma, authority, submissionId, payload());
 await persistHostedIntake(prisma, authority, submissionId, payload());
 await prisma.$executeRaw`UPDATE "HostedRoutingDelivery" SET created_at = NOW() - INTERVAL '6 minutes' WHERE account_id = ${authority.accountId}`;
 await queueStalledRoutingNotices(prisma, authority.accountId, "test"); await queueStalledRoutingNotices(prisma, authority.accountId, "test");
 const notices = await prisma.notification.findMany({where: {account_id: authority.accountId, subject: "Routing operator evidence"}});
 expect(notices).toHaveLength(2);
 expect(notices.every(n => n.channel === "in_app" && n.status === "queued")).toBe(true);
 expect(JSON.stringify(notices)).not.toContain("synthetic@example.invalid");
 expect(await prisma.notification.count({where: {account_id: "org_mock_2", subject: "Routing operator evidence"}})).toBe(0);
});
