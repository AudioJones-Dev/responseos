import { z } from "zod";
import { requireReviewOperator } from "@/lib/callReview/service";
import { continueWithdrawalDatabase } from "@/lib/callReview/withdrawalRecovery";

const Input = z.strictObject({
  receiptId: z.string().min(1).max(200), expectedAccountId: z.string().min(1).max(200),
  expectedProviderCallId: z.string().min(1).max(500), generation: z.number().int().positive(),
  original: z.strictObject({ disclosureRef: z.string().max(200), evidenceRef: z.string().max(200), jurisdictionBasis: z.string().max(100), withdrawalSourceTime: z.unknown().optional() }).optional(),
});

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireReviewOperator();
    const parsed = Input.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return Response.json({ ok: false, error: "invalid_withdrawal_recovery_request" }, { status: 422 });
    const data = await continueWithdrawalDatabase({ ...parsed.data, captureId: (await context.params).id });
    return Response.json({ ok: true, data }, { status: data.withdrawal.drain === "confirmed" ? 200 : 202, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "withdrawal_recovery_unavailable";
    const safe = ["operator_required", "withdrawal_target_mismatch", "existing_withdrawal_receipt_required"];
    return Response.json({ ok: false, error: safe.includes(reason) ? reason : "withdrawal_recovery_unavailable", providerAction: "none" }, { status: reason === "operator_required" ? 403 : safe.includes(reason) ? 409 : 503 });
  }
}