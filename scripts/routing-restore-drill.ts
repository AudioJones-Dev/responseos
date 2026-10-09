import {PrismaClient} from "@prisma/client";
import {randomUUID, createHash} from "node:crypto";
import {readFile, writeFile} from "node:fs/promises";
import {persistHostedIntake, claimDelivery, settleDelivery, saveCheckpoint} from "../lib/routing/ledger";
import {runWorkerBatch} from "../lib/routing/worker";
import {SimulatedRoutingProvider} from "../lib/routing/simulatedProvider";
const url = new URL(process.env.DATABASE_URL ?? "");
if (process.env.ROUTING_RESTORE_SYNTHETIC_ONLY !== "true" || !["localhost", "127.0.0.1"].includes(url.hostname) || !["/postgres", "/responseos_test", "/responseos_restore"].includes(url.pathname)) throw new Error("restore_drill_local_synthetic_only");
const db = new PrismaClient();
const file = process.env.ROUTING_RESTORE_SNAPSHOT;
if (!file) throw new Error("snapshot_path_required");
const snapshot = async (accountId: string) => {
 const tables = await Promise.all([db.frlWebIntake.findMany({where: {account_id: accountId}, orderBy: {id: "asc"}}), db.hostedRoutingDelivery.findMany({where: {account_id: accountId}, orderBy: {id: "asc"}}), db.auditLog.findMany({where: {account_id: accountId}, orderBy: {id: "asc"}}), db.notification.findMany({where: {account_id: accountId}, orderBy: {id: "asc"}})]);
 return {digest: createHash("sha256").update(JSON.stringify(tables)).digest("hex"), counts: tables.map(t => t.length)};
};
async function main() {
if (!file) throw new Error("snapshot_path_required");
try {
 if (process.argv[2] === "prepare") {
  const accountId = `restore_${randomUUID().replaceAll("-", "")}`;
  await db.account.create({data: {id: accountId, name: "Synthetic restore drill", slug: accountId, industry: "test", timezone: "UTC"}});
  const authority = {accountId, keyId: "restore-drill", environment: "test" as const, audience: "restore-drill", retentionDays: 7};
  const requests = [];
  for (const outcome of ["confirmed", "rejected", "uncertain", "interrupted"] as const) {
   const id = randomUUID();
   const body = {schemaVersion: 1, inquiry: {inquiryId: id, sourceEventId: `restore-${id}`, sourceChannel: "form", pathway: "residential", occurredAt: "2026-10-09T04:00:00.000Z", nextActionAt: "2026-10-10T04:00:00.000Z", contact: {email: "restore@example.invalid", firstName: "Synthetic", preferredMethod: "email"}, qualification: "qualified", qualificationReason: "Synthetic", disposition: "continue", decisionReference: "restore-drill", service: "stair_lift", jobType: "sales_installation", city: "TEST", urgency: "routine", contactPermission: true, paymentArrangement: "self_pay", vetaccessRequest: false, summary: "Synthetic only", nextAction: "Synthetic review", source: {page: "/", landingPage: "/", utmSource: "test"}}};
   const receipt = await persistHostedIntake(db, authority, id, body);
   if (outcome === "confirmed") await runWorkerBatch(db, accountId, "test", new SimulatedRoutingProvider(), 1);
   else {
    const claim = (await claimDelivery(db, accountId, "test"))!;
    if (outcome === "interrupted") {
     await saveCheckpoint(db, claim, {...claim.checkpoint_json, inFlight: "task"});
     await db.$executeRaw`UPDATE "HostedRoutingDelivery" SET lease_until = NOW() - INTERVAL '1 second' WHERE id = ${claim.id} AND account_id = ${accountId}`;
    } else await settleDelivery(db, claim, outcome, "synthetic_restore_fixture");
   }
   requests.push({id, body, reference: receipt.reference, outcome});
  }
  const evidence = {accountId, authority, requests, snapshot: await snapshot(accountId)};
  await writeFile(file, JSON.stringify(evidence));
  console.log(JSON.stringify({phase: "prepared", counts: evidence.snapshot.counts, syntheticOnly: true}));
 } else if (process.argv[2] === "verify") {
  const expected = JSON.parse(await readFile(file, "utf8"));
  const restored = await snapshot(expected.accountId);
  if (restored.digest !== expected.snapshot.digest) throw new Error("restore_digest_mismatch");
  const confirmed = expected.requests.find((r: {outcome: string}) => r.outcome === "confirmed");
  const replay = await persistHostedIntake(db, expected.authority, confirmed.id, confirmed.body);
  if (!replay.replay || replay.reference !== confirmed.reference || replay.deliveryStatus !== "confirmed") throw new Error("restored_receipt_mismatch");
  if (await claimDelivery(db, expected.accountId, "test")) throw new Error("unsafe_redispatch_after_restore");
  const rows = await db.hostedRoutingDelivery.findMany({where: {account_id: expected.accountId}});
  const states = rows.map(r => r.status).sort();
  if (JSON.stringify(states) !== JSON.stringify(["confirmed", "rejected", "uncertain", "uncertain"])) throw new Error("restored_recovery_state_invalid");
  if (await claimDelivery(db, expected.accountId, "test")) throw new Error("uncertain_redispatch");
  console.log(JSON.stringify({phase: "verified", digestMatched: true, counts: restored.counts, states, replayPreserved: true, uncertainRedispatched: false, providerCallsDuringRecovery: 0}));
 } else throw new Error("prepare_or_verify_required");
} finally {await db.$disconnect();}

}
void main();

