import { dispatchQualifiedNotificationDeliveries } from "@/lib/notifications/qualifiedCallDelivery";
import { respondWithResult } from "@/lib/providers/webhook-helpers";

export async function POST() {
  return respondWithResult(await dispatchQualifiedNotificationDeliveries());
}
