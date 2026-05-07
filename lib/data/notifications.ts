import "@/lib/serverOnlyGuard";
import { db } from "@/lib/db/client";
import type {
  Notification,
  NotificationChannel,
  NotificationStatus,
} from "@/types/notification";
import { err, errFromThrown, ok, type Result } from "./result";
import { withTenantScope } from "./session-helpers";

interface NotificationRow {
  id: string;
  organization_id: string;
  lead_event_id: string | null;
  channel: string;
  recipient: string;
  subject: string | null;
  message: string;
  status: string;
  sent_at: Date | null;
  created_at: Date;
}

function rowToNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    organization_id: row.organization_id,
    lead_event_id: row.lead_event_id ?? undefined,
    channel: row.channel as NotificationChannel,
    recipient: row.recipient,
    subject: row.subject ?? undefined,
    message: row.message,
    status: row.status as NotificationStatus,
    sent_at: row.sent_at ? row.sent_at.toISOString() : undefined,
    created_at: row.created_at.toISOString(),
  };
}

export async function listNotifications(params: {
  organizationId?: string;
}): Promise<Result<Notification[]>> {
  const scope = await withTenantScope(params.organizationId);
  if (!scope.ok) return err(scope.error.code, scope.error.message);

  if (db === null) {
    return ok([]);
  }

  try {
    const rows = await db.notification.findMany({
      where: scope.effectiveOrgId
        ? { organization_id: scope.effectiveOrgId }
        : undefined,
      orderBy: { created_at: "desc" },
    });
    return ok(rows.map(rowToNotification));
  } catch (e) {
    return errFromThrown<Notification[]>(e);
  }
}
