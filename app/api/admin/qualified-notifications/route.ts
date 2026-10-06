import { listQualifiedNotificationDeliveries } from "@/lib/notifications/qualifiedCallDelivery";
import { respondWithResult } from "@/lib/providers/webhook-helpers";

export async function GET() {
  return respondWithResult(await listQualifiedNotificationDeliveries(), { transform: (deliveries) => ({ deliveries }) });
}
