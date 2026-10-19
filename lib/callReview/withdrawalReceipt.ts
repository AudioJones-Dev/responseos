import "@/lib/serverOnlyGuard";
import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { createRecoveringClient, type RecoveringClient } from "@/lib/db/recoveringClient";
import { withCaptureLock } from "./consent";

declare global {
  var __responseos_receipt_prisma__: RecoveringClient | null | undefined;
}
function receiptClient() {
  if (!process.env.DATABASE_URL) return null;
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set("connection_limit", "1");
  url.searchParams.set("pool_timeout", "1");
  url.searchParams.set("connect_timeout", "1");
  return createRecoveringClient({ datasources: { db: { url: url.toString() } } });
}
export const withdrawalReceiptDb = globalThis.__responseos_receipt_prisma__ ?? receiptClient();
if (process.env.NODE_ENV !== "production") globalThis.__responseos_receipt_prisma__ = withdrawalReceiptDb;
type Capture = { id: string; account_id: string; provider_call_id: string };
export type WithdrawalInput = { eventKey: string; disclosureRef: string; evidenceRef: string; jurisdictionBasis: string; withdrawalSourceTime?: unknown };
export function withdrawalRequestHash(value: WithdrawalInput) {
  return createHash('sha256').update(JSON.stringify([value.disclosureRef, value.evidenceRef, value.jurisdictionBasis, value.withdrawalSourceTime ?? null])).digest('hex');
}
export async function receiptTransaction<T>(run: (tx: Prisma.TransactionClient) => Promise<T>) {
  if (!withdrawalReceiptDb) throw Error("database_unavailable");
  return withdrawalReceiptDb.$transaction(async tx => {
    await tx.$executeRaw`SET LOCAL lock_timeout = '250ms'`;
    await tx.$executeRaw`SET LOCAL statement_timeout = '500ms'`;
    await tx.$executeRaw`SET LOCAL idle_in_transaction_session_timeout = '1000ms'`;
    return run(tx);
  }, { isolationLevel: "ReadCommitted", maxWait: 250, timeout: 1500 });
}
export async function persistWithdrawalReceipt(capture: Capture, actorId: string, value: WithdrawalInput) {
  return receiptTransaction(async tx => {
    const current = await tx.callCaptureSession.findUniqueOrThrow({ where: { id: capture.id, account_id: capture.account_id, provider_call_id: capture.provider_call_id } });
    const source = value.withdrawalSourceTime && typeof value.withdrawalSourceTime === "object" ? value.withdrawalSourceTime as Record<string, unknown> : {};
    await tx.$executeRaw`INSERT INTO "CallWithdrawalReceipt"
      (id, account_id, capture_id, provider_call_id, generation, actor_user_id, event_key, request_hash, source_time_claim, source_provenance, received_at)
      VALUES (${randomUUID()}, ${current.account_id}, ${current.id}, ${current.provider_call_id}, ${current.generation}, ${actorId}, ${value.eventKey}, ${withdrawalRequestHash(value)},
        ${typeof source.occurredAt === "string" ? source.occurredAt.slice(0, 128) : null}, ${source.attestation === "operator_witness" ? "operator_witness_claim" : "unverified"},
        COALESCE(${current.withdrawal_received_at}::timestamp, date_trunc('milliseconds', clock_timestamp() AT TIME ZONE 'UTC')))
      ON CONFLICT (account_id, provider_call_id) DO NOTHING`;
    const receipt = await tx.callWithdrawalReceipt.findUniqueOrThrow({ where: { account_id_provider_call_id: { account_id: current.account_id, provider_call_id: current.provider_call_id } } });
    if (receipt.capture_id !== current.id) throw Error("withdrawal_target_conflict");
    return receipt;
  });
}

export async function drainWithdrawal(capture: Capture) {
  return withCaptureLock(capture.account_id, capture.provider_call_id, async tx => {
    const receipt = await tx.callWithdrawalReceipt.findUniqueOrThrow({ where: { account_id_provider_call_id: { account_id: capture.account_id, provider_call_id: capture.provider_call_id } } });
    if (receipt.capture_id !== capture.id) throw Error("withdrawal_target_conflict");
    const current = await tx.callCaptureSession.findUniqueOrThrow({ where: { id: capture.id, account_id: capture.account_id } });
    if (current.withdrawal_drained_at) return current;
    const boundary = new Date(Math.min(receipt.received_at.getTime(), current.content_admission_closed_at?.getTime() ?? Infinity));
    return tx.callCaptureSession.update({ where: { id: capture.id, account_id: capture.account_id }, data: {
      withdrawal_received_at: current.withdrawal_received_at ?? receipt.received_at, content_admission_closed_at: boundary,
      withdrawal_drained_at: receipt.received_at,
      control_state: current.control_state === "STOPPED" ? "STOPPED" : "STOP_PENDING",
    } });
  }, { bounded: true });
}

export async function withdrawalProgress(capture: Capture) {
  return receiptTransaction(async tx => {
    const receipt = await tx.callWithdrawalReceipt.findUnique({ where: { account_id_provider_call_id: { account_id: capture.account_id, provider_call_id: capture.provider_call_id } } });
    const current = await tx.callCaptureSession.findUniqueOrThrow({ where: { id: capture.id, account_id: capture.account_id } });
    const stop = await tx.telnyxCallCommand.findFirst({ where: { account_id: capture.account_id, capture_session_id: capture.id, command_type: "ai_assistant_stop", generation: current.generation }, select: { status: true } });
    return { receipt: receipt || current.withdrawal_received_at ? "recorded" as const : "not_recorded" as const,
      receivedAt: receipt?.received_at ?? current.withdrawal_received_at,
      drain: current.withdrawal_drained_at ? "confirmed" as const : "pending" as const,
      drainedAt: current.withdrawal_drained_at, aiStop: stop?.status ?? "not_requested", providerCessationConfirmed: false as const };
  });
}

export async function withdrawalFailure(capture: Capture, error: unknown) {
  try {
    const progress = await withdrawalProgress(capture);
    if (progress.receipt === "recorded") return progress;
    const sqlState = (error as { meta?: { code?: string } })?.meta?.code;
    if (["55P03", "57014", "23503", "23514"].includes(sqlState ?? "")) return progress;
  } catch { /* An unavailable readback cannot resolve commit uncertainty. */ }
  return { receipt: "unknown" as const, receivedAt: null, drain: "pending" as const, drainedAt: null, aiStop: "unknown", providerCessationConfirmed: false as const };
}

export async function assertReceiptAwareIsolation(client: Prisma.TransactionClient) {
  const [state] = await client.$queryRaw<{ isolation: string }[]>`SELECT current_setting('transaction_isolation') AS isolation`;
  if (state.isolation !== "read committed") throw Error("receipt_requires_read_committed");
}

