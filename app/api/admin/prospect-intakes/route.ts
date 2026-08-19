import { listProspectIntakes } from "@/lib/data/prospectIntakes";
import { errorResponse, respondWithResult } from "@/lib/providers/webhook-helpers";

export async function GET(req: Request) {
  const accountId = process.env.RESPONSEOS_INBOUND_ACCOUNT_ID;
  if (!accountId) {
    return errorResponse(503, {
      code: "intake_unavailable",
      message: "Prospect intake is not configured.",
    });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? undefined;
  if (
    status &&
    !["received", "reviewed", "qualified", "rejected"].includes(status)
  ) {
    return errorResponse(422, {
      code: "validation_failed",
      message: "Unknown prospect intake status.",
    });
  }

  const result = await listProspectIntakes({
    accountId,
    status: status as "received" | "reviewed" | "qualified" | "rejected" | undefined,
  });
  return respondWithResult(result, { transform: (intakes) => ({ intakes }) });
}
