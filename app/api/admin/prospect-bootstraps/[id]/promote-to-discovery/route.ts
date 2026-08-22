import { promoteProspectToDiscovery } from "@/lib/clientEnvironment/service";
import { respondWithResult } from "@/lib/providers/webhook-helpers";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await req.json().catch(() => ({})) as { promotionAcknowledged?: boolean };
  return respondWithResult(await promoteProspectToDiscovery({
    bootstrapId: id,
    promotionAcknowledged: body.promotionAcknowledged === true,
  }));
}
