import "@/lib/serverOnlyGuard";
import { createHash } from "node:crypto";
import { db } from "@/lib/db/client";
import { requireReviewOperator } from "@/lib/callReview/service";
import { providerCallHasWithdrawal } from "@/lib/callReview/withdrawal";
import { withCaptureLock } from "@/lib/callReview/consent";
import { BusinessMemorySnapshotSchema } from "@/lib/prospectBootstrap/contracts";
import { readOperatingConfigurationValue } from "@/lib/agentExecution/operatingConfiguration";

export async function inspectWithdrawalTransfer(input: {
  captureId: string; expectedAccountId: string; expectedSnapshotId: string;
  generation: number; destination: string;
}) {
  await requireReviewOperator();
  if (!db) throw new Error("database_unavailable");
  const located = await db.callCaptureSession.findUnique({ where: { id: input.captureId } });
  if (!located || located.account_id !== input.expectedAccountId) throw new Error("transfer_target_mismatch");
  return withCaptureLock(located.account_id, located.provider_call_id, async client => {
    const capture = await client.callCaptureSession.findUniqueOrThrow({ where: { id: located.id, account_id: located.account_id } });
    if (capture.generation !== input.generation || capture.snapshot_id !== input.expectedSnapshotId) throw new Error("transfer_target_mismatch");
    if (!await providerCallHasWithdrawal(capture.account_id, capture.provider_call_id, client)) throw new Error("withdrawal_required");
    const memory = BusinessMemorySnapshotSchema.safeParse(capture.snapshot_json);
    if (!memory.success || memory.data.accountId !== capture.account_id || memory.data.conflicts.length) throw new Error("transfer_snapshot_unavailable");
    const destination = readOperatingConfigurationValue(memory.data, "contact.escalation.primary")?.phone;
    if (!destination || destination !== input.destination) throw new Error("transfer_destination_denied");
    const policy = readOperatingConfigurationValue(memory.data, "policy.consent");
    if (!policy || policy.recording.enabled !== false) throw new Error("recording_off_policy_required");
    if (!capture.assignment_id || !capture.call_session_id || !capture.call_leg_id || !capture.conversation_id) throw new Error("transfer_identity_incomplete");
    const assignment = await client.telephonyNumberAssignment.findFirst({ where: { id: capture.assignment_id, account_id: capture.account_id } });
    if (!assignment || assignment.status !== "qualification" || assignment.unassigned_at) throw new Error("qualification_assignment_required");
    const requestId = createHash("sha256").update(JSON.stringify([
      "withdrawal-transfer-preflight-v1", capture.account_id, capture.id, capture.provider_call_id,
      capture.call_session_id, capture.call_leg_id, capture.conversation_id, capture.generation,
      capture.snapshot_id, capture.snapshot_json, destination,
    ])).digest("hex");
    // Policy, a successful command and conversation-end metadata are not qualified cessation/recording evidence.
    // There is deliberately no provider dispatch or environment-variable escape hatch here.
    return {
      requestId, attempted: false as const, connected: false as const, enabled: false as const,
      reason: "qualified_stop_recording_evidence_adapter_unavailable" as const,
      announcement: "omitted_no_approved_wording" as const,
    };
  });
}
