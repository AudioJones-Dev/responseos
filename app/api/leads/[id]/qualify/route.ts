import { NextResponse } from "next/server";
import { leadQualificationScore } from "@/lib/scoring/leadQualificationScore";
import { QualifyLeadInputSchema } from "@/lib/validation/lead";
import { errorResponse, methodNotAllowed, safeJson } from "@/lib/providers/webhook-helpers";

// lead_event_id comes from the path, not the body (docs/api-spec.md).
const QualifyBodySchema = QualifyLeadInputSchema.omit({ lead_event_id: true });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = await safeJson(req);
  if (!parsed.ok) {
    return errorResponse(400, parsed.error);
  }
  const body = QualifyBodySchema.safeParse(parsed.data);
  if (!body.success) {
    return errorResponse(400, {
      code: "validation_failed",
      message: "Request body does not match the lead qualification contract.",
      details: { issues: body.error.issues },
    });
  }
  const score = leadQualificationScore(body.data);
  return NextResponse.json({
    ok: true,
    mock: true,
    data: { lead_event_id: id, qualification_score: score },
  });
}

export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const DELETE = methodNotAllowed;
