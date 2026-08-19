import {
  listCrmSyncOperations,
  type CrmSyncStatus,
} from "@/lib/crm/syncFinalizedCall";
import { errorResponse, respondWithResult } from "@/lib/providers/webhook-helpers";

const STATUSES = new Set<CrmSyncStatus>([
  "pending",
  "processing",
  "succeeded",
  "retryable_failed",
  "review_required",
  "cancelled",
]);

export async function GET(req: Request) {
  const accountId = process.env.RESPONSEOS_DEMO_ACCOUNT_ID;
  if (!accountId) {
    return errorResponse(503, {
      code: "demo_account_unavailable",
      message: "The demo account is not configured.",
    });
  }
  const status = new URL(req.url).searchParams.get("status") ?? undefined;
  if (status && !STATUSES.has(status as CrmSyncStatus)) {
    return errorResponse(422, {
      code: "validation_failed",
      message: "Unknown CRM sync status.",
    });
  }
  return respondWithResult(
    await listCrmSyncOperations({ accountId, status: status as CrmSyncStatus | undefined }),
    { transform: (operations) => ({ operations }) },
  );
}
