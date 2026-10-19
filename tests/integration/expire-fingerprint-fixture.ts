import type { Prisma } from "@prisma/client";
import { prisma } from "./setup";

// Owner-only time travel for synthetic fixtures; runtime cannot disable triggers.
export async function expireFingerprintFixture(id: string, at = new Date(1000), client?: Prisma.TransactionClient) {
  const expire = async (tx: Prisma.TransactionClient) => {
    await tx.$executeRawUnsafe('ALTER TABLE "WebhookEvent" DISABLE TRIGGER "WebhookEvent_fingerprint_guard"');
    await tx.webhookEvent.update({ where: { id }, data: { payload_expires_at: at } });
    await tx.$executeRawUnsafe('ALTER TABLE "WebhookEvent" ENABLE TRIGGER "WebhookEvent_fingerprint_guard"');
  };
  if (client) await expire(client);
  else await prisma.$transaction(expire);
}
