import { retryQualifiedCallHandoff } from "@/lib/crm/qualifiedCallHandoff";
import { respondWithResult } from "@/lib/providers/webhook-helpers";

export async function POST(_req: Request, context: { params: Promise<{ callId: string }> }) {
  const { callId } = await context.params;
  return respondWithResult(await retryQualifiedCallHandoff(callId));
}
