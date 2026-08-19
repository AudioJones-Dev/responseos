import "@/lib/serverOnlyGuard";
import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import type { AuditRequest } from "@/lib/validation/audit-request";
import { err, errFromThrown, ok, type Result } from "./result";

export type ProspectIntakeStatus =
  | "received"
  | "reviewed"
  | "qualified"
  | "rejected";

export interface ProspectIntake {
  id: string;
  account_id: string;
  reference: string;
  status: ProspectIntakeStatus;
  request: AuditRequest | null;
  notification_status: "pending" | "sent" | "failed";
  notification_error?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  expires_at: string;
  purged_at?: string;
  created_at: string;
  updated_at: string;
}

interface ProspectIntakeRow {
  id: string;
  account_id: string;
  reference: string;
  request_json: Prisma.JsonValue | null;
  status: string;
  notification_status: string;
  notification_error: string | null;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  expires_at: Date;
  purged_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

const RETENTION_DAYS = 90;

function toIntake(row: ProspectIntakeRow): ProspectIntake {
  return {
    id: row.id,
    account_id: row.account_id,
    reference: row.reference,
    status: row.status as ProspectIntakeStatus,
    request: row.request_json as AuditRequest | null,
    notification_status: row.notification_status as ProspectIntake["notification_status"],
    notification_error: row.notification_error ?? undefined,
    reviewed_by: row.reviewed_by ?? undefined,
    reviewed_at: row.reviewed_at?.toISOString(),
    expires_at: row.expires_at.toISOString(),
    purged_at: row.purged_at?.toISOString(),
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export function hashProspectPayload(payload: AuditRequest): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function isValidIdempotencyKey(value: string | null): value is string {
  return value !== null && /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(value);
}

export async function createProspectIntake(params: {
  accountId: string;
  idempotencyKey: string;
  request: AuditRequest;
  now?: Date;
}): Promise<Result<{ intake: ProspectIntake; replay: boolean }>> {
  if (db === null) {
    return err("no_database", "Prospect intake requires a database connection.");
  }

  const payloadHash = hashProspectPayload(params.request);

  try {
    const existing = await db.prospectIntake.findUnique({
      where: {
        account_id_idempotency_key: {
          account_id: params.accountId,
          idempotency_key: params.idempotencyKey,
        },
      },
    });
    if (existing) {
      if (existing.payload_hash !== payloadHash) {
        return err(
          "idempotency_conflict",
          "The Idempotency-Key was already used for a different request.",
        );
      }
      return ok({ intake: toIntake(existing), replay: true });
    }

    const now = params.now ?? new Date();
    const expiresAt = new Date(now.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const created = await db.prospectIntake.create({
      data: {
        account_id: params.accountId,
        reference: `audit_${randomUUID().replaceAll("-", "").slice(0, 16)}`,
        idempotency_key: params.idempotencyKey,
        payload_hash: payloadHash,
        request_json: params.request,
        expires_at: expiresAt,
        created_at: now,
      },
    });
    return ok({ intake: toIntake(created), replay: false });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const replay = await db.prospectIntake.findUnique({
        where: {
          account_id_idempotency_key: {
            account_id: params.accountId,
            idempotency_key: params.idempotencyKey,
          },
        },
      });
      if (replay?.payload_hash === payloadHash) {
        return ok({ intake: toIntake(replay), replay: true });
      }
      return err(
        "idempotency_conflict",
        "The Idempotency-Key was already used for a different request.",
      );
    }
    return errFromThrown(error);
  }
}

export async function setProspectNotificationResult(params: {
  id: string;
  sent: boolean;
  error?: string;
}): Promise<void> {
  if (db === null) return;
  await db.prospectIntake.update({
    where: { id: params.id },
    data: {
      notification_status: params.sent ? "sent" : "failed",
      notification_error: params.sent ? null : (params.error ?? "notification_failed"),
    },
  });
}

export async function listProspectIntakes(params: {
  accountId: string;
  status?: ProspectIntakeStatus;
  limit?: number;
}): Promise<Result<ProspectIntake[]>> {
  try {
    await requireRole(["aj_admin", "operator"]);
  } catch (error) {
    return errFromThrown(error);
  }
  if (db === null) return ok([]);

  try {
    const rows = await db.prospectIntake.findMany({
      where: {
        account_id: params.accountId,
        ...(params.status ? { status: params.status } : {}),
      },
      orderBy: { created_at: "desc" },
      take: Math.min(params.limit ?? 100, 200),
    });
    return ok(rows.map(toIntake));
  } catch (error) {
    return errFromThrown(error);
  }
}

const ALLOWED_TRANSITIONS: Record<ProspectIntakeStatus, ProspectIntakeStatus[]> = {
  received: ["reviewed"],
  reviewed: ["qualified", "rejected"],
  qualified: [],
  rejected: [],
};

export async function transitionProspectIntake(params: {
  id: string;
  accountId: string;
  status: ProspectIntakeStatus;
}): Promise<Result<{ before: ProspectIntake; after: ProspectIntake }>> {
  let user;
  try {
    user = await requireRole(["aj_admin", "operator"]);
  } catch (error) {
    return errFromThrown(error);
  }
  if (db === null) return err("no_database", "Prospect intake requires a database connection.");

  try {
    const transition = await db.$transaction(async (tx) => {
      const current = await tx.prospectIntake.findFirst({
        where: { id: params.id, account_id: params.accountId },
      });
      if (!current) return { error: "not_found" as const };
      if (!ALLOWED_TRANSITIONS[current.status].includes(params.status)) {
        return { error: "invalid_transition" as const, current };
      }
      const updated = await tx.prospectIntake.update({
        where: { id: current.id },
        data: {
          status: params.status,
          reviewed_by: user.user.id,
          reviewed_at: new Date(),
        },
      });
      await tx.auditLog.create({
        data: {
          account_id: params.accountId,
          actor_user_id: user.user.id,
          actor_type: "user",
          actor_role: user.user.role,
          action: "prospect_intake.status_changed",
          category: "workflow",
          target_type: "ProspectIntake",
          target_id: updated.id,
          before_ref: { status: current.status },
          after_ref: { status: updated.status },
        },
      });
      return { current, updated };
    });
    if ("error" in transition) {
      if (transition.error === "not_found") return err("not_found", "Prospect intake not found.");
      return err(
        "invalid_transition",
        `Cannot move a prospect intake from ${transition.current.status} to ${params.status}.`,
      );
    }
    return ok({ before: toIntake(transition.current), after: toIntake(transition.updated) });
  } catch (error) {
    return errFromThrown(error);
  }
}

export async function purgeExpiredUnqualifiedProspectPii(params: {
  accountId: string;
  now?: Date;
}): Promise<Result<{ purged: number }>> {
  if (db === null) return err("no_database", "Prospect purge requires a database connection.");
  try {
    const result = await db.prospectIntake.updateMany({
      where: {
        account_id: params.accountId,
        status: { not: "qualified" },
        expires_at: { lte: params.now ?? new Date() },
        purged_at: null,
      },
      data: {
        request_json: Prisma.JsonNull,
        purged_at: params.now ?? new Date(),
      },
    });
    return ok({ purged: result.count });
  } catch (error) {
    return errFromThrown(error);
  }
}
