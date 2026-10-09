import "@/lib/serverOnlyGuard";
import { createHash, randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { inquirySchema, type Inquiry } from "./frlPlan";
import { providerConfigurationHash, routeInquiry } from "./frlManifest";
import { HostedIntakeError, type HostedAuthority } from "./hostedAuth";
import { queueOperatorNotice } from "./notifications";

export type Checkpoint = { manifestHash?: string; planFingerprint?: string; contactId?: string; inquiryId?: string; companyId?: string; companyApprovalReference?: string; noteId?: string; taskId?: string; edges?: string[]; associated?: boolean; reviewRequired?: boolean; inFlight?: "contact" | "inquiry" | "association" | "note" | "task" };
export type Delivery = { id: string; account_id: string; intake_id: string; mode: string; status: string; attempt_count: number; dispatch_token: string | null; checkpoint_json: Checkpoint; reference: string; payload_hash: string; request_json: {schemaVersion: 1; inquiry: Inquiry}; environment: string; expires_at: Date };
type Tx = Prisma.TransactionClient;
async function audit(tx: Tx, accountId: string, id: string, action: string, code?: string, actorId?: string, metadata: Record<string, string> = {}) {
  await tx.auditLog.create({ data: { account_id: accountId, actor_type: actorId ? "user" : "system", actor_user_id: actorId, action: `hosted_routing.${action}`, category: "workflow", target_type: "HostedRoutingDelivery", target_id: id, after_ref: { code: code ?? action, ...metadata }, expires_at: new Date(Date.now() + 365 * 86400000) } });
}
export async function persistHostedIntake(db: PrismaClient, authority: HostedAuthority, submissionId: string, payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new HostedIntakeError(400, "invalid_payload");
  const raw = payload as {schemaVersion?: unknown; inquiry?: unknown};
  if (Object.keys(raw).some(k => !["schemaVersion", "inquiry"].includes(k)) || raw.schemaVersion !== 1 || !raw.inquiry || typeof raw.inquiry !== "object" || Array.isArray(raw.inquiry) || "accountId" in raw.inquiry) throw new HostedIntakeError(400, "invalid_payload");
  const parsed = inquirySchema.safeParse({ ...raw.inquiry, accountId: authority.accountId });
  if (!parsed.success || parsed.data.inquiryId !== submissionId) throw new HostedIntakeError(400, "invalid_payload");
  const canonical = { schemaVersion: 1 as const, inquiry: parsed.data };
  const hash = createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
  return db.$transaction(async tx => {
    const accounts = await tx.$queryRaw<{id: string}[]>`SELECT id FROM "Account" WHERE id = ${authority.accountId} FOR UPDATE`;
    if (accounts.length !== 1) throw new HostedIntakeError(403, "tenant_unavailable");
    const existing = await tx.frlWebIntake.findUnique({ where: { account_id_environment_submission_id: { account_id: authority.accountId, environment: authority.environment, submission_id: submissionId } } });
    if (existing) {
      if (existing.payload_hash !== hash) throw new HostedIntakeError(409, "idempotency_conflict");
      const rows = await tx.$queryRaw<{status: string; mode: string}[]>`SELECT status, mode FROM "HostedRoutingDelivery" WHERE account_id = ${authority.accountId} AND intake_id = ${existing.id}`;
      if (rows.length !== 1) throw new HostedIntakeError(409, "receipt_contract_conflict");
      return { reference: existing.reference, status: "received", deliveryStatus: rows[0].status, mode: rows[0].mode, replay: true };
    }
    const plan = routeInquiry(parsed.data, authority.environment);
    const intake = await tx.frlWebIntake.create({ data: { account_id: authority.accountId, environment: authority.environment, submission_id: submissionId, reference: `frl_${randomUUID()}`, payload_hash: hash, request_json: canonical, expires_at: new Date(Date.now() + authority.retentionDays * 86400000) } });
    const id = randomUUID();
    await tx.$executeRaw`INSERT INTO "HostedRoutingDelivery" (id, account_id, intake_id, manifest_version, checkpoint_json, updated_at) VALUES (${id}, ${authority.accountId}, ${intake.id}, 'frl-hubspot.v1', ${JSON.stringify({manifestHash: providerConfigurationHash, planFingerprint: plan.fingerprint})}::jsonb, NOW())`;
    await audit(tx, authority.accountId, id, "received", undefined, undefined, {keyId: authority.keyId, environment: authority.environment, audience: authority.audience, manifestHash: providerConfigurationHash});
    await queueOperatorNotice(tx, authority.accountId, id, "received");
    return { reference: intake.reference, status: "received", deliveryStatus: "queued", mode: "simulated", replay: false };
  });
}
export async function claimDelivery(db: PrismaClient, accountId: string, environment: "test" | "preview") {
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Account" WHERE id = ${accountId} FOR UPDATE`;
    const expired = await tx.$queryRaw<{id: string}[]>`UPDATE "HostedRoutingDelivery" d SET status = 'uncertain', dispatch_token = NULL, lease_until = NULL, last_error_code = 'lease_expired', updated_at = NOW() FROM "FrlWebIntake" i WHERE d.account_id = ${accountId} AND i.account_id = d.account_id AND i.id = d.intake_id AND i.environment = ${environment} AND d.status = 'dispatching' AND d.lease_until <= NOW() RETURNING d.id`;
    for (const row of expired) {await audit(tx, accountId, row.id, "uncertain", "lease_expired"); await queueOperatorNotice(tx, accountId, row.id, "uncertain");}
    const rows = await tx.$queryRaw<Delivery[]>`SELECT d.*, i.reference, i.payload_hash, i.request_json, i.environment, i.expires_at FROM "HostedRoutingDelivery" d JOIN "FrlWebIntake" i ON i.id = d.intake_id AND i.account_id = d.account_id WHERE d.account_id = ${accountId} AND i.environment = ${environment} AND d.mode = 'simulated' AND d.status = 'queued' AND d.next_attempt_at <= NOW() AND d.attempt_count < 5 AND i.expires_at > NOW() AND i.purged_at IS NULL ORDER BY d.created_at LIMIT 1 FOR UPDATE OF d SKIP LOCKED`;
    if (!rows[0]) return null;
    const row = rows[0]; const token = randomUUID();
    await tx.$executeRaw`UPDATE "HostedRoutingDelivery" SET status = 'dispatching', attempt_count = attempt_count + 1, dispatch_token = ${token}, lease_until = NOW() + INTERVAL '60 seconds', updated_at = NOW() WHERE id = ${row.id} AND account_id = ${accountId}`;
    await audit(tx, accountId, row.id, "claimed");
    return { ...row, dispatch_token: token, attempt_count: row.attempt_count + 1, status: "dispatching" };
  });
}
export async function saveCheckpoint(db: PrismaClient, delivery: Delivery, checkpoint: Checkpoint) {
  const count = await db.$executeRaw`UPDATE "HostedRoutingDelivery" SET checkpoint_json = ${JSON.stringify(checkpoint)}::jsonb, updated_at = NOW() WHERE id = ${delivery.id} AND account_id = ${delivery.account_id} AND status = 'dispatching' AND dispatch_token = ${delivery.dispatch_token} AND lease_until > NOW()`;
  if (count !== 1) throw new Error("dispatch_fence_lost");
}
export async function settleDelivery(db: PrismaClient, delivery: Delivery, outcome: "confirmed" | "rejected" | "uncertain" | "retry", code: string) {
  return db.$transaction(async tx => {
    const retry = outcome === "retry" && delivery.attempt_count < 5;
    const status = retry ? "queued" : outcome === "retry" ? "rejected" : outcome;
    const count = await tx.$executeRaw`UPDATE "HostedRoutingDelivery" SET status = ${status}, dispatch_token = NULL, lease_until = NULL, confirmed_at = CASE WHEN ${status} = 'confirmed' THEN NOW() ELSE NULL END, next_attempt_at = NOW() + (${Math.min(300, 2 ** delivery.attempt_count)} * INTERVAL '1 second'), last_error_code = ${code}, updated_at = NOW() WHERE id = ${delivery.id} AND account_id = ${delivery.account_id} AND status = 'dispatching' AND dispatch_token = ${delivery.dispatch_token} AND lease_until > NOW()`;
    if (count !== 1) throw new Error("dispatch_fence_lost");
    await audit(tx, delivery.account_id, delivery.id, status, code);
    if (!retry) await queueOperatorNotice(tx, delivery.account_id, delivery.id, code === "operator_review_required" ? code : status);
    return status;
  });
}
export async function deliveryStatus(db: PrismaClient, accountId: string, reference: string) {
  const rows = await db.$queryRaw<{reference: string; environment: string; status: string; mode: string; attempt_count: number; last_error_code: string | null}[]>`SELECT i.reference, i.environment, d.status, d.mode, d.attempt_count, d.last_error_code FROM "HostedRoutingDelivery" d JOIN "FrlWebIntake" i ON i.id = d.intake_id AND i.account_id = d.account_id WHERE d.account_id = ${accountId} AND i.reference = ${reference}`;
  return rows[0] ?? null;
}
export async function reconcileSimulatedDelivery(db: PrismaClient, accountId: string, reference: string, actorId: string, decision: "accepted" | "not_accepted", evidenceReference: string) {
  if (!/^[a-zA-Z0-9_.:-]{1,120}$/.test(evidenceReference)) throw new Error("evidence_required");
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Account" WHERE id = ${accountId} FOR UPDATE`;
    const rows = await tx.$queryRaw<Delivery[]>`SELECT d.* FROM "HostedRoutingDelivery" d JOIN "FrlWebIntake" i ON i.id = d.intake_id AND i.account_id = d.account_id WHERE d.account_id = ${accountId} AND i.reference = ${reference} AND d.mode = 'simulated' AND d.status = 'uncertain' FOR UPDATE OF d`;
    const row = rows[0]; if (!row) throw new Error("reconciliation_refused");
    // Simulated evidence cannot release a live provider operation.
    const status = decision === "accepted" ? "confirmed" : "rejected";
    await tx.$executeRaw`UPDATE "HostedRoutingDelivery" SET status = ${status}, confirmed_at = CASE WHEN ${status} = 'confirmed' THEN NOW() ELSE NULL END, updated_at = NOW(), last_error_code = 'operator_reconciled' WHERE id = ${row.id} AND account_id = ${accountId}`;
    await audit(tx, accountId, row.id, "reconciled", evidenceReference, actorId);
    await queueOperatorNotice(tx, accountId, row.id, `reconciled_${status}`);
    return status;
  });
}
export async function queueStalledRoutingNotices(db: PrismaClient, accountId: string, environment: "test" | "preview") {
  await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Account" WHERE id = ${accountId} FOR UPDATE`;
    const stalled = await tx.$queryRaw<{id: string}[]>`SELECT d.id FROM "HostedRoutingDelivery" d JOIN "FrlWebIntake" i ON i.id = d.intake_id AND i.account_id = d.account_id WHERE d.account_id = ${accountId} AND i.environment = ${environment} AND d.status = 'queued' AND d.created_at < NOW() - INTERVAL '5 minutes' AND d.next_attempt_at <= NOW() ORDER BY d.created_at LIMIT 100`;
    for (const row of stalled) await queueOperatorNotice(tx, accountId, row.id, "stalled");
  });
}
