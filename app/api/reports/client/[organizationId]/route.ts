import { NextResponse } from "next/server";
import { getMockRevenueMetrics } from "@/lib/mock/revenueMetrics";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await params;
  const metrics = getMockRevenueMetrics().filter(
    (m) => m.organization_id === organizationId,
  );
  return NextResponse.json({
    ok: true,
    mock: true,
    data: { organization_id: organizationId, metrics },
  });
}
