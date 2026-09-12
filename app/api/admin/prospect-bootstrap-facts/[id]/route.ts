import { reviewKnowledgeFact } from "@/lib/prospectBootstrap/service";
import type { KnowledgeFactStatus } from "@/lib/prospectBootstrap/contracts";
import { errorResponse, respondWithResult, safeJson } from "@/lib/providers/webhook-helpers";

const DECISIONS = new Set<KnowledgeFactStatus>(["operator_approved_for_demo", "owner_confirmed", "rejected"]);

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const parsed = await safeJson<{ status?: KnowledgeFactStatus }>(req);
  if (!parsed.ok) return errorResponse(400, parsed.error);
  if (!parsed.data.status || !DECISIONS.has(parsed.data.status)) {
    return errorResponse(422, { code: "validation_failed", message: "A valid fact-review decision is required." });
  }
  const { id } = await context.params;
  return respondWithResult(await reviewKnowledgeFact({ factId: id, status: parsed.data.status }));
}
