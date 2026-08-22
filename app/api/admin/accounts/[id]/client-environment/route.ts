import { buildClientEnvironmentManifest } from "@/lib/clientEnvironment/service";
import { respondWithResult } from "@/lib/providers/webhook-helpers";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return respondWithResult(await buildClientEnvironmentManifest(id));
}
