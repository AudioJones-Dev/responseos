import "@/lib/serverOnlyGuard";
import { randomUUID } from "node:crypto";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { FrlWebIntakeError } from "./frlWebIntakes";

export type MockDeliveryKind = "crm" | "notification" | "marketing";
type ClaimResult =
  | { status: "claimed"; token: string; operationId: string; mode: "mock" }
  | {
      status: "blocked" | "dispatching" | "uncertain" | "rejected";
      receiptId?: undefined;
    }
  | { status: "confirmed"; receiptId: string };

async function context() {
  const session = await requireRole(["aj_admin", "operator", "client_admin"]);
  if (!session.account?.id) throw new FrlWebIntakeError("tenant_required");
  if (!db) throw new FrlWebIntakeError("no_database");
  return { session, accountId: session.account.id, database: db };
}

function enabled() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.RESPONSEOS_FRL_MOCK_DISPATCH_ENABLED === "true"
  );
}

export async function claimFrlMockDelivery(
  reference: string,
  kind: MockDeliveryKind,
): Promise<ClaimResult> {
  const { session, accountId, database } = await context();
  if (!enabled()) return { status: "blocked" as const };
  if (
    !/^frl_[0-9a-f-]{36}$/.test(reference) ||
    !["crm", "notification", "marketing"].includes(kind)
  )
    throw new FrlWebIntakeError("invalid_request");
  try {
    return await database.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Account" WHERE id = ${accountId} FOR UPDATE`;
      const intake = await tx.frlWebIntake.findFirst({
        where: { reference, account_id: accountId },
      });
      if (
        !intake ||
        intake.environment !== "test" ||
        intake.purged_at ||
        intake.expires_at <= new Date()
      )
        return { status: "blocked" as const };
      const key = {
        account_id_intake_id_kind: {
          account_id: accountId,
          intake_id: intake.id,
          kind,
        },
      };
      const operation = await tx.frlMockDelivery.findUnique({ where: key });
      if (!operation || operation.mode !== "mock")
        return { status: "blocked" as const };
      if (
        operation.status === "dispatching" &&
        operation.lease_until! <= new Date()
      ) {
        await tx.frlMockDelivery.update({
          where: key,
          data: {
            status: "uncertain",
            dispatch_token: null,
            lease_until: null,
          },
        });
        await tx.auditLog.create({
          data: {
            account_id: accountId,
            actor_user_id: session.user.id,
            actor_type: "user",
            actor_role: session.user.role,
            action: "frl_mock_delivery.lease_expired",
            category: "workflow",
            target_type: "FrlMockDelivery",
            target_id: operation.id,
          },
        });
        return { status: "uncertain" as const };
      }
      if (operation.status === "confirmed")
        return {
          status: "confirmed" as const,
          receiptId: operation.receipt_id!,
        };
      if (["dispatching", "uncertain", "rejected"].includes(operation.status))
        return {
          status: operation.status as "dispatching" | "uncertain" | "rejected",
        };
      if (operation.status !== "blocked")
        throw new FrlWebIntakeError("conflict");
      if (operation.attempt_count >= 3) return { status: "rejected" as const };
      if (kind !== "crm") {
        const crm = await tx.frlMockDelivery.findUnique({
          where: {
            account_id_intake_id_kind: {
              account_id: accountId,
              intake_id: intake.id,
              kind: "crm",
            },
          },
        });
        if (crm?.status !== "confirmed") return { status: "blocked" as const };
      }
      const token = randomUUID();
      await tx.frlMockDelivery.update({
        where: key,
        data: {
          status: "dispatching",
          dispatch_token: token,
          lease_until: new Date(Date.now() + 60_000),
          attempt_count: { increment: 1 },
        },
      });
      await tx.auditLog.create({
        data: {
          account_id: accountId,
          actor_user_id: session.user.id,
          actor_type: "user",
          actor_role: session.user.role,
          action: "frl_mock_delivery.claimed",
          category: "workflow",
          target_type: "FrlMockDelivery",
          target_id: operation.id,
          after_ref: {
            kind,
            mode: "mock",
            attempt: operation.attempt_count + 1,
          },
        },
      });
      return {
        status: "claimed" as const,
        token,
        operationId: operation.id,
        mode: "mock" as const,
      };
    });
  } catch (error) {
    if (error instanceof FrlWebIntakeError) throw error;
    throw new FrlWebIntakeError("unavailable");
  }
}

export async function requeueRejectedFrlMockDelivery(
  operationId: string,
  proof: string,
) {
  const { session, accountId, database } = await context();
  if (!enabled()) throw new FrlWebIntakeError("unavailable");
  if (!/^mock_nonacceptance_[a-zA-Z0-9_-]{1,60}$/.test(proof))
    throw new FrlWebIntakeError("invalid_request");
  try {
    return await database.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Account" WHERE id = ${accountId} FOR UPDATE`;
      const operation = await tx.frlMockDelivery.findFirst({
        where: { id: operationId, account_id: accountId },
        include: { intake: true },
      });
      if (
        !operation ||
        operation.mode !== "mock" ||
        operation.intake.environment !== "test" ||
        operation.intake.purged_at ||
        operation.intake.expires_at <= new Date() ||
        operation.status !== "rejected" ||
        operation.attempt_count >= 3
      )
        throw new FrlWebIntakeError("conflict");
      await tx.frlMockDelivery.update({
        where: { id: operationId },
        data: { status: "blocked" },
      });
      await tx.auditLog.create({
        data: {
          account_id: accountId,
          actor_user_id: session.user.id,
          actor_type: "user",
          actor_role: session.user.role,
          action: "frl_mock_delivery.requeue_authorized",
          category: "workflow",
          target_type: "FrlMockDelivery",
          target_id: operation.id,
          after_ref: { proof, mode: "mock" },
        },
      });
      return { status: "blocked" as const, mode: "mock" as const };
    });
  } catch (error) {
    if (error instanceof FrlWebIntakeError) throw error;
    throw new FrlWebIntakeError("unavailable");
  }
}

export async function settleFrlMockDelivery(input: {
  operationId: string;
  token: string;
  outcome: "confirmed" | "rejected" | "uncertain";
  receiptId?: string;
}) {
  const { session, accountId, database } = await context();
  if (!enabled()) throw new FrlWebIntakeError("unavailable");
  if (
    !["confirmed", "rejected", "uncertain"].includes(input.outcome) ||
    (input.outcome === "confirmed"
      ? !/^mock_[a-zA-Z0-9_-]{1,80}$/.test(input.receiptId ?? "")
      : input.receiptId !== undefined)
  )
    throw new FrlWebIntakeError("invalid_request");
  try {
    return await database.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Account" WHERE id = ${accountId} FOR UPDATE`;
      const operation = await tx.frlMockDelivery.findFirst({
        where: { id: input.operationId, account_id: accountId },
        include: { intake: true },
      });
      if (
        !operation ||
        operation.intake.environment !== "test" ||
        operation.mode !== "mock" ||
        operation.status !== "dispatching" ||
        operation.dispatch_token !== input.token
      )
        throw new FrlWebIntakeError("conflict");
      const outcome =
        operation.lease_until! <= new Date() ? "uncertain" : input.outcome;
      await tx.frlMockDelivery.update({
        where: { id: operation.id },
        data: {
          status: outcome,
          dispatch_token: null,
          lease_until: null,
          receipt_id: outcome === "confirmed" ? input.receiptId : null,
        },
      });
      await tx.auditLog.create({
        data: {
          account_id: accountId,
          actor_user_id: session.user.id,
          actor_type: "user",
          actor_role: session.user.role,
          action: "frl_mock_delivery.settled",
          category: "workflow",
          target_type: "FrlMockDelivery",
          target_id: operation.id,
          after_ref: { outcome, mode: "mock" },
        },
      });
      return { status: outcome, mode: "mock" as const };
    });
  } catch (error) {
    if (error instanceof FrlWebIntakeError) throw error;
    throw new FrlWebIntakeError("unavailable");
  }
}
