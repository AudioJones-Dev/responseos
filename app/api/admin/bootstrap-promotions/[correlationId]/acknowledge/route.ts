import { acknowledgeImportedBootstrapPromotion } from "@/lib/prospectBootstrap/service";
import { errorResponse, respondWithResult, safeJson } from "@/lib/providers/webhook-helpers";

export async function POST(req: Request, context: { params: Promise<{ correlationId: string }> }) {
  const parsed = await safeJson<{ manifestHash?: unknown; importedAccountRef?: unknown }>(req);
  if (!parsed.ok) return errorResponse(400, parsed.error);
  if (typeof parsed.data.manifestHash !== "string" || typeof parsed.data.importedAccountRef !== "string") {
    return errorResponse(422, {
      code: "validation_failed",
      message: "manifestHash and importedAccountRef are required strings.",
    });
  }
  const { correlationId } = await context.params;
  return respondWithResult(await acknowledgeImportedBootstrapPromotion({
    correlationId,
    manifestHash: parsed.data.manifestHash,
    importedAccountRef: parsed.data.importedAccountRef,
  }));
}
