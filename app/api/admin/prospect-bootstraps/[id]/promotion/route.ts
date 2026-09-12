import { exportBootstrapPromotion } from "@/lib/prospectBootstrap/service";
import { respondWithResult } from "@/lib/providers/webhook-helpers";

export async function POST(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return respondWithResult(await exportBootstrapPromotion({ bootstrapId: id }));
}
