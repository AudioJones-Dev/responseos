import { z } from "zod";
import { requireReviewOperator } from "@/lib/callReview/service";
import { inspectWithdrawalTransfer } from "@/lib/callControl/withdrawalTransfer";

const Input = z.strictObject({
  expectedAccountId: z.string().min(1).max(200), expectedSnapshotId: z.string().min(1).max(200),
  generation: z.number().int().positive(), destination: z.string().regex(/^\+[1-9]\d{7,14}$/),
});
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireReviewOperator();
    const parsed = Input.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return Response.json({ ok: false, error: "invalid_transfer_request" }, { status: 422 });
    const data = await inspectWithdrawalTransfer({ ...parsed.data, captureId: (await context.params).id });
    return Response.json({ ok: false, error: data.reason, data }, { status: 423 });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "transfer_unavailable";
    const safe = ["operator_required", "transfer_target_mismatch", "withdrawal_required", "transfer_snapshot_unavailable", "transfer_destination_denied", "recording_off_policy_required", "transfer_identity_incomplete", "qualification_assignment_required"];
    return Response.json({ ok: false, error: safe.includes(reason) ? reason : "transfer_unavailable" }, { status: reason === "operator_required" ? 403 : safe.includes(reason) ? 409 : 503 });
  }
}
