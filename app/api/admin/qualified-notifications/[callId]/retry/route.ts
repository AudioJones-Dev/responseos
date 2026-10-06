import { retryQualifiedNotificationDelivery } from "@/lib/notifications/qualifiedCallDelivery";
import { respondWithResult } from "@/lib/providers/webhook-helpers";

export async function POST(_req: Request, context: { params: Promise<{ callId: string }> }) {
  const { callId } = await context.params;
  return respondWithResult(await retryQualifiedNotificationDelivery(callId));
}
