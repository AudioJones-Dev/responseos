import { NextResponse } from "next/server";
import { getMockBookings } from "@/lib/mock/bookings";
import { errorResponse } from "@/lib/providers/webhook-helpers";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const b = getMockBookings().find((x) => x.id === id);
  if (!b) {
    return errorResponse(404, {
      code: "not_found",
      message: `Booking ${id} not found.`,
    });
  }
  return NextResponse.json({ ok: true, mock: true, data: b });
}
