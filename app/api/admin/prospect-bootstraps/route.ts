import { createProspectBootstrap } from "@/lib/prospectBootstrap/service";
import { errorResponse, respondWithResult, safeJson } from "@/lib/providers/webhook-helpers";

export async function POST(req: Request) {
  const parsed = await safeJson<{
    businessName?: string;
    canonicalWebsite?: string;
    timezone?: string;
    prospectIntakeId?: string;
  }>(req);
  if (!parsed.ok) return errorResponse(400, parsed.error);
  if (!parsed.data.businessName?.trim() || !parsed.data.canonicalWebsite?.trim()) {
    return errorResponse(422, { code: "validation_failed", message: "Business name and public HTTPS website are required." });
  }
  return respondWithResult(await createProspectBootstrap({
    businessName: parsed.data.businessName,
    canonicalWebsite: parsed.data.canonicalWebsite,
    timezone: parsed.data.timezone,
    prospectIntakeId: parsed.data.prospectIntakeId,
  }), { successStatus: 201 });
}
