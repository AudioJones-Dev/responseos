import "@/lib/serverOnlyGuard";
import type { CallFollowUpReason, Prisma, QualificationStatus } from "@prisma/client";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { err, errFromThrown, ok, type Result } from "@/lib/data/result";

export const FOLLOW_UP_DUE_HOURS = 24;

export interface CallFollowUpView {
  id: string;
  call_id: string;
  reason: CallFollowUpReason;
  status: "open" | "resolved";
  owner_user_id: string;
  backup_user_id: string;
  due_at: string;
  resolved_at: string | null;
}

export function followUpReason(status: QualificationStatus | null | undefined): CallFollowUpReason | null {
  if (status === "qualified" || status === "spam") return null;
  return status ?? "not_scored";
}

export async function followUpRoutingReady(accountId: string): Promise<boolean> {
  if (!db) return false;
  const routing = await db.followUpRouting.findUnique({ where: { account_id: accountId } });
  return !!routing?.owner_user_id && !!routing.backup_user_id;
}

// Idempotent on account and call. A later re-score never closes an open record;
// only an operator resolves it.
export async function recordCallFollowUp(
  client: Prisma.TransactionClient,
  params: { accountId: string; callId: string; status: QualificationStatus | null | undefined; now?: Date },
): Promise<"created" | "exists" | "not_needed" | "routing_missing"> {
  const reason = followUpReason(params.status);
  if (!reason) return "not_needed";
  const existing = await client.callFollowUp.findUnique({
    where: { account_id_call_id: { account_id: params.accountId, call_id: params.callId } },
  });
  if (existing) return "exists";
  const routing = await client.followUpRouting.findUnique({ where: { account_id: params.accountId } });
  if (!routing?.owner_user_id || !routing.backup_user_id) return "routing_missing";
  const now = params.now ?? new Date();
  await client.callFollowUp.create({
    data: {
      account_id: params.accountId,
      call_id: params.callId,
      reason,
      owner_user_id: routing.owner_user_id,
      backup_user_id: routing.backup_user_id,
      due_at: new Date(now.getTime() + FOLLOW_UP_DUE_HOURS * 60 * 60 * 1000),
    },
  });
  await client.auditLog.create({
    data: {
      account_id: params.accountId,
      actor_type: "system",
      action: "call_follow_up.created",
      category: "workflow",
      target_type: "Call",
      target_id: params.callId,
      reason: "Finalized call is not qualified; a human follow-up is required (ADR-0086).",
      metadata_json: { reason, owner_user_id: routing.owner_user_id, backup_user_id: routing.backup_user_id },
    },
  });
  return "created";
}

function toView(row: {
  id: string; call_id: string; reason: CallFollowUpReason; status: "open" | "resolved";
  owner_user_id: string; backup_user_id: string; due_at: Date; resolved_at: Date | null;
}): CallFollowUpView {
  return {
    id: row.id, call_id: row.call_id, reason: row.reason, status: row.status,
    owner_user_id: row.owner_user_id, backup_user_id: row.backup_user_id,
    due_at: row.due_at.toISOString(), resolved_at: row.resolved_at?.toISOString() ?? null,
  };
}

export async function listCallFollowUps(params: { accountId: string }): Promise<Result<CallFollowUpView[]>> {
  try {
    await requireRole(["aj_admin", "operator"]);
  } catch (error) {
    return errFromThrown(error);
  }
  if (db === null) return ok([]);
  const rows = await db.callFollowUp.findMany({
    where: { account_id: params.accountId },
    orderBy: [{ status: "asc" }, { due_at: "asc" }],
    take: 100,
  });
  return ok(rows.map(toView));
}

export async function resolveCallFollowUp(params: { id: string; accountId: string; now?: Date }): Promise<Result<CallFollowUpView>> {
  let session;
  try {
    session = await requireRole(["aj_admin", "operator"]);
  } catch (error) {
    return errFromThrown(error);
  }
  if (db === null) return err("no_database", "Follow-up resolution requires a database connection.");
  const now = params.now ?? new Date();
  return db.$transaction(async (tx) => {
    const current = await tx.callFollowUp.findFirst({ where: { id: params.id, account_id: params.accountId } });
    if (!current) return err("not_found", "Follow-up not found.");
    if (current.status !== "open") return err("invalid_transition", "Only open follow-ups can be resolved.");
    const updated = await tx.callFollowUp.update({
      where: { id: current.id },
      data: { status: "resolved", resolved_at: now, resolved_by_user_id: session.user.id },
    });
    await tx.auditLog.create({
      data: {
        account_id: params.accountId,
        actor_user_id: session.user.id,
        actor_type: "user",
        actor_role: session.user.role,
        action: "call_follow_up.resolved",
        category: "workflow",
        target_type: "CallFollowUp",
        target_id: current.id,
        before_ref: { status: current.status },
        after_ref: { status: "resolved" },
      },
    });
    return ok(toView(updated));
  });
}
