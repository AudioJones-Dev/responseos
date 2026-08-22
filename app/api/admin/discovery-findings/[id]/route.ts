import { reviewDiscoveryFinding } from "@/lib/clientEnvironment/service";
import { respondWithResult } from "@/lib/providers/webhook-helpers";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  return respondWithResult(await reviewDiscoveryFinding({ factId: id, input: body }));
}
