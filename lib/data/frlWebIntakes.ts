import "@/lib/serverOnlyGuard";
import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { FrlWebInquirySchema } from "@/lib/validation/frl-web-inquiry";

export class FrlWebIntakeError extends Error {
  constructor(
    readonly code:
      | "tenant_required"
      | "invalid_request"
      | "no_database"
      | "conflict"
      | "unavailable",
  ) {
    super(code);
  }
}

export async function persistFrlWebIntake(input: {
  submissionId: string;
  environment: "test" | "preview" | "production";
  request: unknown;
}) {
  const session = await requireRole(["aj_admin", "operator", "client_admin"]);
  if (!session.account?.id) throw new FrlWebIntakeError("tenant_required");
  const parsed = FrlWebInquirySchema.safeParse(input.request);
  if (
    !parsed.success ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      input.submissionId,
    ) ||
    !["test", "preview", "production"].includes(input.environment)
  ) {
    throw new FrlWebIntakeError("invalid_request");
  }
  if (!db) throw new FrlWebIntakeError("no_database");
  const accountId = session.account.id;
  const submissionId = input.submissionId.toLowerCase();
  const hash = createHash("sha256")
    .update(JSON.stringify(parsed.data))
    .digest("hex");
  try {
    return await db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Account" WHERE id = ${accountId} FOR UPDATE`;
        const key = {
          account_id_environment_submission_id: {
            account_id: accountId,
            environment: input.environment,
            submission_id: submissionId,
          },
        };
        const existing = await tx.frlWebIntake.findUnique({ where: key });
        if (existing) {
          if (existing.payload_hash !== hash)
            throw new FrlWebIntakeError("conflict");
          return {
            reference: existing.reference,
            status: "received" as const,
            deliveryStatus: existing.delivery_status,
            replay: true,
          };
        }
        const row = await tx.frlWebIntake.create({
          data: {
            account_id: accountId,
            environment: input.environment,
            submission_id: submissionId,
            reference: `frl_${randomUUID()}`,
            payload_hash: hash,
            request_json: parsed.data,
            delivery_status: "blocked",
            expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          },
        });
        await tx.auditLog.create({
          data: {
            account_id: accountId,
            actor_user_id: session.user.id,
            actor_type: "user",
            actor_role: session.user.role,
            action: "frl_web_intake.received",
            category: "workflow",
            target_type: "FrlWebIntake",
            target_id: row.id,
            after_ref: { reference: row.reference, delivery_status: "blocked" },
          },
        });
        return {
          reference: row.reference,
          status: "received" as const,
          deliveryStatus: row.delivery_status,
          replay: false,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  } catch (error) {
    if (error instanceof FrlWebIntakeError) throw error;
    throw new FrlWebIntakeError("unavailable");
  }
}

export async function purgeExpiredFrlWebIntakePayloads() {
  const session = await requireRole(["aj_admin", "operator", "client_admin"]);
  if (!session.account?.id) throw new FrlWebIntakeError("tenant_required");
  if (!db) throw new FrlWebIntakeError("no_database");
  const accountId = session.account.id;
  try {
    return await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Account" WHERE id = ${accountId} FOR UPDATE`;
      const result = await tx.frlWebIntake.updateMany({
        where: {
          account_id: accountId,
          expires_at: { lte: new Date() },
          purged_at: null,
          delivery_status: "blocked",
        },
        data: { request_json: Prisma.JsonNull, purged_at: new Date() },
      });
      if (result.count)
        await tx.auditLog.create({
          data: {
            account_id: accountId,
            actor_user_id: session.user.id,
            actor_type: "user",
            actor_role: session.user.role,
            action: "frl_web_intake.payload_purged",
            category: "workflow",
            target_type: "FrlWebIntake",
            after_ref: { purged: result.count },
          },
        });
      return { purged: result.count };
    });
  } catch {
    throw new FrlWebIntakeError("unavailable");
  }
}
