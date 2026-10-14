import { z } from "zod";

export const FRL_INTERACTIONS = ["new_sales", "existing_customer_new_sale", "new_service", "existing_service", "project_coordination", "administrative"] as const;
export const FRL_OUTCOMES = ["QUALIFIED_FREE_EVALUATION", "QUALIFIED_QUOTE_REVIEW", "BUILDER_GC_PROJECT_REVIEW", "COMMERCIAL_PROJECT_REVIEW", "EXISTING_CUSTOMER_SERVICE", "EXISTING_PROJECT_FOLLOW_UP", "HUMAN_REVIEW_REQUIRED", "OUTSIDE_APPROVED_SERVICE_AREA", "PRODUCT_COMPATIBILITY_REVIEW", "PERMIT_COMPLIANCE_REVIEW", "UNSUPPORTED_REQUEST"] as const;

export const ReviewPayloadSchema = z.strictObject({
  caller: z.string().trim().min(1).max(160),
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/),
  interaction: z.enum(FRL_INTERACTIONS),
  product: z.enum(["vpl", "vehicle_lift", "ceiling_lift", "ramp", "unknown"]),
  location: z.string().max(200),
  summary: z.string().trim().min(1).max(2000),
  qualification: z.enum(["qualified", "maybe", "unqualified", "spam"]),
  outcome: z.enum(FRL_OUTCOMES),
  urgency: z.enum(["low", "medium", "high"]),
  callbackWindow: z.string().max(200),
  nextAction: z.string().trim().min(1).max(1000),
  flags: z.array(z.string().max(300)).max(20),
});
export type ReviewPayload = z.infer<typeof ReviewPayloadSchema>;

export function reviewMessage(value: ReviewPayload, callId: string) {
  return {
    subject: `FRL CALLBACK REQUIRED — ${value.caller} — ${value.product === "unknown" ? value.interaction : value.product} — ${value.location || "Location unconfirmed"}`,
    text: [
      "Supervised FRL demonstration — fictional customer scenario.",
      `Caller: ${value.caller}`, `Callback: ${value.phone}`,
      `Interaction: ${value.interaction}`, `Product: ${value.product}`,
      `Location: ${value.location || "Unconfirmed"}`, `Qualification: ${value.qualification}`,
      `Outcome: ${value.outcome}`, `Urgency: ${value.urgency}`,
      `Callback window: ${value.callbackWindow || "Not specified"}`,
      `Summary: ${value.summary}`, `Next action: ${value.nextAction}`,
      `Review flags: ${value.flags.join("; ") || "None"}`,
      `ResponseOS transcript reference: ${callId}`,
      `CRM evidence reference: ResponseOS call ${callId}`,
      "CRM delivery status is tracked in ResponseOS; this message does not certify CRM synchronization.",
    ].join("\n"),
  };
}
