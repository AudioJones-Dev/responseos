import { NextResponse } from "next/server";
import { getMockLeadEvents } from "@/lib/mock/leads";
import { errorResponse } from "@/lib/providers/webhook-helpers";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const lead = getMockLeadEvents().find((l) => l.id === id);
  if (!lead) {
    return errorResponse(404, {
      code: "not_found",
      message: `LeadEvent ${id} not found.`,
    });
  }
  return NextResponse.json({ ok: true, mock: true, data: lead });
}
