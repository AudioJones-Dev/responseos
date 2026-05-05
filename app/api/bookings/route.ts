import { NextResponse } from "next/server";
import { getMockBookings } from "@/lib/mock/bookings";

export async function GET() {
  return NextResponse.json({ ok: true, mock: true, data: getMockBookings() });
}
