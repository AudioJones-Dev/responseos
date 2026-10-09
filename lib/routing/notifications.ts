import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
export async function queueOperatorNotice(tx: Prisma.TransactionClient, accountId: string, deliveryId: string, event: string) {
  const id = `routing_${createHash("sha256").update(JSON.stringify([accountId, deliveryId, event])).digest("hex")}`;
  const prior = await tx.notification.findUnique({where: {id, account_id: accountId}});
  if (prior) return;
  await tx.notification.create({data: {id, account_id: accountId, channel: "in_app", recipient: "routing-operators", subject: "Routing operator evidence", message: JSON.stringify({deliveryId, event, externalDelivery: "disabled"}), status: "queued"}});
  await tx.auditLog.create({data: {account_id: accountId, actor_type: "system", action: "hosted_routing.notification_queued", category: "workflow", target_type: "HostedRoutingDelivery", target_id: deliveryId, after_ref: {event, channel: "in_app", externalDelivery: "disabled"}, expires_at: new Date(Date.now() + 365 * 86400000)}});
}
