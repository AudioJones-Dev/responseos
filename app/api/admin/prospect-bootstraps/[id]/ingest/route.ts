import { ingestProspectBootstrap } from "@/lib/prospectBootstrap/service";
import { errorResponse, respondWithResult } from "@/lib/providers/webhook-helpers";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const rawBody = await req.text();
  let approvedSameSiteUrls: string[] = [];
  if (rawBody) {
    try {
      const parsed = JSON.parse(rawBody) as { approvedSameSiteUrls?: unknown };
      if (
        parsed.approvedSameSiteUrls !== undefined &&
        (!Array.isArray(parsed.approvedSameSiteUrls) || parsed.approvedSameSiteUrls.some((value) => typeof value !== "string"))
      ) {
        return errorResponse(422, { code: "validation_failed", message: "Approved same-site URLs must be a string array." });
      }
      approvedSameSiteUrls = (parsed.approvedSameSiteUrls as string[] | undefined) ?? [];
    } catch {
      return errorResponse(400, { code: "invalid_json", message: "Request body must be valid JSON." });
    }
  }
  const { id } = await context.params;
  return respondWithResult(await ingestProspectBootstrap({ bootstrapId: id, approvedSameSiteUrls }));
}
