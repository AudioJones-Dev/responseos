import { NextResponse } from "next/server";
import { getCurrentMockRevenueMetrics } from "@/lib/mock/revenueMetrics";

export async function GET() {
  return NextResponse.json({
    ok: true,
    mock: true,
    data: getCurrentMockRevenueMetrics(),
  });
}
