import { listQualifiedCallHandoffs } from "@/lib/crm/qualifiedCallHandoff";
import { errorResponse, respondWithResult } from "@/lib/providers/webhook-helpers";

export async function GET() {
  const accountId = process.env.RESPONSEOS_FRL_HANDOFF_ACCOUNT_ID;
  if (!accountId) return errorResponse(503, { code: "handoff_account_unavailable", message: "Qualified handoff account is not configured." });
  return respondWithResult(await listQualifiedCallHandoffs(accountId), { transform: (handoffs) => ({ handoffs }) });
}
