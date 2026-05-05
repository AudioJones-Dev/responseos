import { NextResponse } from "next/server";
import { errorResponse, methodNotAllowed, safeJson } from "@/lib/providers/webhook-helpers";
import type { LeadEventStatus } from "@/types/lead";

interface StatusUpdate {
  status: LeadEventStatus;
  notes?: string;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = await safeJson<StatusUpdate>(req);
  if (!parsed.ok) {
    return errorResponse(400, parsed.error);
  }
  return NextResponse.json({
    ok: true,
    mock: true,
    data: { lead_event_id: id, status: parsed.data.status },
  });
}

export const GET = methodNotAllowed;
