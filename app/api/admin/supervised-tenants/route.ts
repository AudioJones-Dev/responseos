import { configureSupervisedTenant, type SupervisedTenantInput } from "@/lib/agentExecution/supervisedTenant";
import { errorResponse, respondWithResult, safeJson } from "@/lib/providers/webhook-helpers";

/**
 * Operator-only write path for supervised tenant configuration (ADR-0052).
 * Client operational values arrive here in the request body and go straight to
 * the database; they are never echoed back beyond configured key names.
 */
export async function POST(req: Request) {
  const parsed = await safeJson<Partial<SupervisedTenantInput>>(req);
  if (!parsed.ok) return errorResponse(400, parsed.error);
  const body = parsed.data;

  if (!body.accountSlug || !body.businessName || !body.timezone || !body.agentName || !body.executionMode) {
    return errorResponse(422, {
      code: "validation_failed",
      message: "accountSlug, businessName, timezone, agentName, and executionMode are required.",
    });
  }
  if (!Array.isArray(body.configuration)) {
    return errorResponse(422, {
      code: "validation_failed",
      message: "configuration must be an array of { key, value } entries.",
    });
  }
  if (!body.approvalRecordRef) {
    return errorResponse(422, {
      code: "validation_failed",
      message: "approvalRecordRef must cite the operator approval record for this configuration.",
    });
  }

  return respondWithResult(
    await configureSupervisedTenant({
      accountSlug: body.accountSlug,
      businessName: body.businessName,
      timezone: body.timezone,
      industry: body.industry,
      agentName: body.agentName,
      executionMode: body.executionMode,
      approvalRecordRef: body.approvalRecordRef,
      configuration: body.configuration,
      number: body.number,
      activate: body.activate,
      dryRun: body.dryRun,
    }),
  );
}
