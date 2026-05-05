import { NextResponse } from "next/server";
import { getMockQuoteRequests } from "@/lib/mock/quotes";
import { errorResponse } from "@/lib/providers/webhook-helpers";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const q = getMockQuoteRequests().find((x) => x.id === id);
  if (!q) {
    return errorResponse(404, {
      code: "not_found",
      message: `QuoteRequest ${id} not found.`,
    });
  }
  return NextResponse.json({ ok: true, mock: true, data: q });
}
