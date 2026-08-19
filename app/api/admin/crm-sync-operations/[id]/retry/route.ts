import { after, NextResponse } from "next/server";
import {
  prepareCrmSyncRetry,
  runCrmSyncForCall,
} from "@/lib/crm/syncFinalizedCall";
import { errorResponse } from "@/lib/providers/webhook-helpers";

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const accountId = process.env.RESPONSEOS_DEMO_ACCOUNT_ID;
  if (!accountId) {
    return errorResponse(503, {
      code: "demo_account_unavailable",
      message: "The demo account is not configured.",
    });
  }
  const { id } = await context.params;
  const prepared = await prepareCrmSyncRetry({ id, accountId });
  if (!prepared.ok) {
    return errorResponse(
      prepared.error.code === "invalid_transition" ? 422 : prepared.error.code === "not_found" ? 404 : 403,
      prepared.error,
    );
  }
  after(() =>
    runCrmSyncForCall({
      accountId,
      callId: prepared.data.callId,
      sourceWebhookId: prepared.data.sourceWebhookId,
    }),
  );
  return NextResponse.json({ ok: true, data: { accepted: true } }, { status: 202 });
}
