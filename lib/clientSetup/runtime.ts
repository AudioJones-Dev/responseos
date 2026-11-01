import "@/lib/serverOnlyGuard";
import { db } from "@/lib/db/client";

// Draft presence is a deny marker, never authority to enable a capability.
export async function accountRuntimeAllowed(accountId: string): Promise<boolean> {
  if (!db) return false;
  const account = await db.account.findUnique({ where: { id: accountId }, select: { status: true, setup_draft_json: true } });
  return !!account && account.status !== "paused" && account.setup_draft_json === null;
}
