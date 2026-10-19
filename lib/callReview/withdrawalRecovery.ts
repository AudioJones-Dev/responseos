import "@/lib/serverOnlyGuard";
import { db } from "@/lib/db/client";
import { requireReviewOperator } from "./service";
import { recordWithdrawalEvidence } from "./withdrawal";
import { drainWithdrawal, withdrawalProgress, withdrawalRequestHash } from "./withdrawalReceipt";

export type WithdrawalRecoveryTarget = { captureId: string; receiptId: string; expectedAccountId: string; expectedProviderCallId: string; generation: number };
export type WithdrawalRecoveryInput = WithdrawalRecoveryTarget & { original?: { disclosureRef: string; evidenceRef: string; jurisdictionBasis: string; withdrawalSourceTime?: unknown } };

export async function continueWithdrawalDatabase(input: WithdrawalRecoveryInput) {
  const operator = await requireReviewOperator();
  if (!db) throw Error("database_unavailable");
  const capture = await db.callCaptureSession.findUnique({ where: { id: input.captureId } });
  if (!capture || capture.account_id !== input.expectedAccountId || capture.provider_call_id !== input.expectedProviderCallId || capture.generation !== input.generation) throw Error("withdrawal_target_mismatch");
  const receipt = await db.callWithdrawalReceipt.findFirst({ where: { id: input.receiptId, capture_id: capture.id, account_id: capture.account_id, provider_call_id: capture.provider_call_id } });
  if (!receipt) throw Error("existing_withdrawal_receipt_required");
  if (receipt.generation !== capture.generation) throw Error("withdrawal_target_mismatch");
  try { await drainWithdrawal(capture, receipt.generation); }
  catch (error) {
    if (error instanceof Error && error.message === "withdrawal_target_mismatch") throw error;
    return { withdrawal: await withdrawalProgress(capture), evidence: { state: "review_required" as const, reason: "database_step_interrupted", eventId: null }, providerAction: "none" as const };
  }
  const progress = await withdrawalProgress(capture);
  if (!receipt.event_key || !receipt.request_hash || !input.original) return { withdrawal: progress, evidence: { state: "review_required" as const, reason: "original_inputs_unavailable", eventId: null }, providerAction: "none" as const };
  const value = { ...input.original, eventKey: receipt.event_key };
  if (withdrawalRequestHash(value) !== receipt.request_hash) return { withdrawal: progress, evidence: { state: "review_required" as const, reason: "original_inputs_mismatch", eventId: null }, providerAction: "none" as const };
  const { event, conflict } = await recordWithdrawalEvidence(capture, operator.user.id, value, receipt.received_at, receipt.generation);
  return { withdrawal: progress, evidence: {
    state: conflict || event.source_time_status !== "verified" ? "review_required" as const : "recorded" as const,
    reason: conflict ? "idempotency_conflict" : event.source_time_reason,
    eventId: event.id,
  }, providerAction: "none" as const };
}