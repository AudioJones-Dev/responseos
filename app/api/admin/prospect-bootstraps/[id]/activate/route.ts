import { activateProspectBootstrap } from "@/lib/prospectBootstrap/service";
import { errorResponse, respondWithResult, safeJson } from "@/lib/providers/webhook-helpers";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const parsed = await safeJson<{ activationAcknowledged?: unknown }>(req);
  if (!parsed.ok) return errorResponse(400, parsed.error);
  if (parsed.data.activationAcknowledged !== true) {
    return errorResponse(422, {
      code: "activation_acknowledgment_required",
      message: "Explicit final activation acknowledgment is required.",
    });
  }
  const { id } = await context.params;
  return respondWithResult(await activateProspectBootstrap({
    bootstrapId: id,
    activationAcknowledged: true,
  }));
}
