import { z } from "zod";
import { ReviewPayloadSchema } from "@/lib/callReview/contracts";
import { decideCallReview, dispatchCallReview } from "@/lib/callReview/service";

const Input = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("approve"), revision: z.number().int().positive(), payload: ReviewPayloadSchema }),
  z.strictObject({ action: z.literal("reject"), revision: z.number().int().positive() }),
  z.strictObject({ action: z.literal("dispatch") }),
]);

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const input = Input.safeParse(await req.json().catch(() => null));
  if (!input.success) return Response.json({ ok: false, error: { code: "invalid_review", message: "Check the review fields." } }, { status: 422 });
  try {
    const { id } = await context.params;
    const value = input.data;
    const data = value.action === "dispatch" ? await dispatchCallReview(id)
      : await decideCallReview(id, value.revision, value.action, value.action === "approve" ? value.payload : undefined);
    return Response.json({ ok: true, data });
  } catch (error) {
    const code = error instanceof Error ? error.message : "review_failed";
    const allowed = ["operator_required", "not_found", "stale_review", "recipient_not_configured", "approval_required", "dispatch_in_progress_or_uncertain", "prior_revision_requires_reconciliation", "email_delivery_requires_reconciliation", "live_email_disabled"];
    return Response.json({ ok: false, error: { code: allowed.includes(code) ? code : "review_failed", message: "The action did not complete. Refresh the review and check delivery status before retrying." } }, { status: code === "operator_required" ? 403 : code === "not_found" ? 404 : 409 });
  }
}
