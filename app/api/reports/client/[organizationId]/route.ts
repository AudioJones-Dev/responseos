import { RevenueMetrics } from "@/lib/data";
import { respondWithResult } from "@/lib/providers/webhook-helpers";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await params;
  const result = await RevenueMetrics.listRevenueMetrics({ organizationId });
  return respondWithResult(result, {
    transform: (metrics) => ({
      organization_id: organizationId,
      metrics,
    }),
  });
}
