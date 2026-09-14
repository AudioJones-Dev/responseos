import { z } from "zod";
import { configureSupervisedTenant } from "@/lib/agentExecution/supervisedTenant";
import { errorResponse, respondWithResult, safeJson } from "@/lib/providers/webhook-helpers";

const Input = z.strictObject({
  accountSlug: z.string().trim().min(1), businessName: z.string().trim().min(1),
  timezone: z.string().trim().min(1), agentName: z.string().trim().min(1),
  industry: z.string().optional(), approvalRecordRef: z.string().trim().min(1),
  executionMode: z.enum(["SUPERVISED_PILOT", "PRODUCTION_SUPERVISED", "MANAGED_AUTONOMY"]),
  configuration: z.array(z.strictObject({ key: z.string(), value: z.unknown() })),
  number: z.strictObject({ providerNumberId: z.string().min(1), e164: z.string().min(1), providerAttestation: z.unknown() }).optional(),
  activate: z.boolean().optional(), dryRun: z.boolean().optional(),
});

/**
 * Operator-only write path for supervised tenant configuration (ADR-0057).
 * Client operational values arrive here in the request body and go straight to
 * the database; they are never echoed back beyond configured key names.
 */
export async function POST(req: Request) {
  const parsed = await safeJson<unknown>(req);
  if (!parsed.ok) return errorResponse(400, parsed.error);
  const input = Input.safeParse(parsed.data);
  if (!input.success) {
    return errorResponse(422, {
      code: "validation_failed",
      message: "Check the supervised tenant configuration fields.",
    });
  }

  const body = input.data;
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
