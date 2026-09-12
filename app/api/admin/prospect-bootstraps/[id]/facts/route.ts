import { createManualKnowledgeFact } from "@/lib/prospectBootstrap/service";
import { errorResponse, respondWithResult, safeJson } from "@/lib/providers/webhook-helpers";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const parsed = await safeJson<{
    sourceId?: unknown;
    factKey?: unknown;
    value?: unknown;
    evidenceExcerpt?: unknown;
  }>(req);
  if (!parsed.ok) return errorResponse(400, parsed.error);
  if (
    typeof parsed.data.sourceId !== "string" ||
    typeof parsed.data.factKey !== "string" ||
    typeof parsed.data.value !== "string" ||
    typeof parsed.data.evidenceExcerpt !== "string"
  ) {
    return errorResponse(422, {
      code: "validation_failed",
      message: "sourceId, factKey, value, and evidenceExcerpt are required strings.",
    });
  }
  const { id } = await context.params;
  return respondWithResult(await createManualKnowledgeFact({
    bootstrapId: id,
    sourceId: parsed.data.sourceId,
    factKey: parsed.data.factKey,
    value: parsed.data.value,
    evidenceExcerpt: parsed.data.evidenceExcerpt,
  }));
}
