import { assignTelephonyNumber } from "@/lib/prospectBootstrap/service";
import { errorResponse, respondWithResult, safeJson } from "@/lib/providers/webhook-helpers";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const parsed = await safeJson<{ telephonyNumberId?: string }>(req);
  if (!parsed.ok) return errorResponse(400, parsed.error);
  if (!parsed.data.telephonyNumberId) {
    return errorResponse(422, { code: "validation_failed", message: "Number identifier is required." });
  }
  const { id } = await context.params;
  return respondWithResult(await assignTelephonyNumber({
    bootstrapId: id,
    telephonyNumberId: parsed.data.telephonyNumberId,
  }));
}
