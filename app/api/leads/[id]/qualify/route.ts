import { NextResponse } from "next/server";
import { leadQualificationScore, LeadQualificationInput } from "@/lib/scoring/leadQualificationScore";
import { errorResponse, methodNotAllowed, safeJson } from "@/lib/providers/webhook-helpers";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = await safeJson<LeadQualificationInput>(req);
  if (!parsed.ok) {
    return errorResponse(400, parsed.error);
  }
  const score = leadQualificationScore(parsed.data);
  return NextResponse.json({
    ok: true,
    mock: true,
    data: { lead_event_id: id, qualification_score: score },
  });
}

export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const DELETE = methodNotAllowed;
