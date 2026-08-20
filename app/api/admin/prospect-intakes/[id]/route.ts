import {
  transitionProspectIntake,
  type ProspectIntakeStatus,
} from "@/lib/data/prospectIntakes";
import {
  errorResponse,
  respondWithResult,
  safeJson,
} from "@/lib/providers/webhook-helpers";

const STATUSES = new Set<ProspectIntakeStatus>([
  "reviewed",
  "qualified",
  "rejected",
]);

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const accountId = process.env.RESPONSEOS_INBOUND_ACCOUNT_ID;
  if (!accountId) {
    return errorResponse(503, {
      code: "intake_unavailable",
      message: "Prospect intake is not configured.",
    });
  }

  const parsed = await safeJson<{ status?: ProspectIntakeStatus }>(req);
  if (!parsed.ok) return errorResponse(400, parsed.error);
  if (!parsed.data.status || !STATUSES.has(parsed.data.status)) {
    return errorResponse(422, {
      code: "validation_failed",
      message: "A valid target status is required.",
    });
  }

  const { id } = await context.params;
  const result = await transitionProspectIntake({
    id,
    accountId,
    status: parsed.data.status,
  });
  if (!result.ok) {
    if (result.error.code === "invalid_transition") {
      return errorResponse(422, result.error);
    }
    return respondWithResult(result);
  }

  return respondWithResult(result, { transform: ({ after }) => after });
}
