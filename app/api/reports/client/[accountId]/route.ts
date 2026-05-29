import { RevenueMetrics } from "@/lib/data";
import { respondWithResult } from "@/lib/providers/webhook-helpers";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ accountId: string }> },
) {
  const { accountId } = await params;
  const result = await RevenueMetrics.listRevenueMetrics({ accountId });
  return respondWithResult(result, {
    transform: (metrics) => ({
      account_id: accountId,
      metrics,
    }),
  });
}
