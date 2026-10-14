import { z } from "zod";
import {
  endSupervisedQualification,
  startSupervisedQualification,
} from "@/lib/agentExecution/supervisedQualification";
import { errorResponse, respondWithResult, safeJson } from "@/lib/providers/webhook-helpers";

const Input = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("start"),
    accountSlug: z.string().trim().min(1),
    providerNumberId: z.string().trim().min(1),
    e164: z.string().trim().min(1),
    providerAssistantId: z.string().trim().min(1),
    approvalRecordRef: z.string().trim().min(1),
  }),
  z.strictObject({
    action: z.literal("end"),
    accountSlug: z.string().trim().min(1),
    e164: z.string().trim().min(1),
    reason: z.string().trim().min(1),
  }),
]);

/** Operator-only lifecycle for effects-disabled provider qualification. */
export async function POST(req: Request) {
  const parsed = await safeJson<unknown>(req);
  if (!parsed.ok) return errorResponse(400, parsed.error);
  const input = Input.safeParse(parsed.data);
  if (!input.success) {
    return errorResponse(422, {
      code: "validation_failed",
      message: "Check the supervised qualification fields.",
    });
  }
  return respondWithResult(
    input.data.action === "start"
      ? await startSupervisedQualification(input.data)
      : await endSupervisedQualification(input.data),
  );
}
