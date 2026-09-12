import { approveQuarantinedNumberReuse } from "@/lib/prospectBootstrap/service";
import { respondWithResult } from "@/lib/providers/webhook-helpers";

export async function POST(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return respondWithResult(await approveQuarantinedNumberReuse(id));
}
