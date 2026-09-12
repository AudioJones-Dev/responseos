import { createAndApproveMemorySnapshot } from "@/lib/prospectBootstrap/service";
import { errorResponse, respondWithResult, safeJson } from "@/lib/providers/webhook-helpers";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const parsed = await safeJson<{ reviewAcknowledged?: unknown }>(req);
  if (!parsed.ok) return errorResponse(400, parsed.error);
  if (parsed.data.reviewAcknowledged !== true) {
    return errorResponse(422, {
      code: "review_acknowledgment_required",
      message: "Explicit review acknowledgment is required.",
    });
  }
  const { id } = await context.params;
  return respondWithResult(await createAndApproveMemorySnapshot({
    bootstrapId: id,
    reviewAcknowledged: true,
  }));
}
