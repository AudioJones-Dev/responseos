import type { Prisma } from "@prisma/client";
import { daysAfter, RETENTION_AUDIT_DAYS } from "./periods";

export function retentionAuditData(params: {
  accountId: string | null;
  action: string;
  targetType: string;
  reason: string;
  metadata: Record<string, unknown>;
  now: Date;
}): Prisma.AuditLogUncheckedCreateInput {
  return {
    account_id: params.accountId,
    actor_type: "system",
    action: params.action,
    category: "workflow",
    target_type: params.targetType,
    reason: params.reason,
    metadata_json: params.metadata as Prisma.InputJsonValue,
    expires_at: daysAfter(params.now, RETENTION_AUDIT_DAYS),
  };
}
