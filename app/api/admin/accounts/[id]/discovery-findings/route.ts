import { createDiscoveryFinding } from "@/lib/clientEnvironment/service";
import { respondWithResult } from "@/lib/providers/webhook-helpers";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  return respondWithResult(await createDiscoveryFinding({ accountId: id, input: body }));
}
