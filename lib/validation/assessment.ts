import { z } from "zod";
import { centsSchema, idSchema } from "./common";

export const AssessmentStatusSchema = z.enum([
  "draft",
  "in_review",
  "delivered",
  "signed",
  "declined",
  "expired",
]);

export const FitDiagnosisSchema = z.enum(["ai_fit", "borderline", "no_fit"]);

/**
 * Per spec §11 Q5 → Option A: inputs_json is JSON-typed in the DB and
 * validated server-side via this schema. The 14 fields below are the
 * canonical evaluation set per docs/pricing-and-onboarding.md.
 */
export const AssessmentInputsSchema = z.object({
  missed_call_volume_per_month: z.number().int().nonnegative().optional(),
  after_hours_demand_pct: z.number().min(0).max(100).optional(),
  avg_job_value_cents: centsSchema.optional(),
  close_rate_pct: z.number().min(0).max(100).optional(),
  response_time_seconds_p50: z.number().int().nonnegative().optional(),
  lead_sources: z.array(z.string()).optional(),
  crm_readiness: z.string().optional(),
  booking_workflow: z.string().optional(),
  quote_workflow: z.string().optional(),
  follow_up_process: z.string().optional(),
  calendar_readiness: z.string().optional(),
  escalation_process: z.string().optional(),
  compliance_risk: z.string().optional(),
  notes: z.string().max(4000).optional(),
});
export type AssessmentInputs = z.infer<typeof AssessmentInputsSchema>;

export const CreateAssessmentInputSchema = z.object({
  organization_id: idSchema,
  inputs_json: AssessmentInputsSchema,
});
export type CreateAssessmentInput = z.infer<typeof CreateAssessmentInputSchema>;

export const SubmitAssessmentInputSchema = z.object({
  assessment_report_id: idSchema,
  readiness_score: z.number().int().min(0).max(100).optional(),
  revenue_leak_estimate: centsSchema.optional(),
  fit_diagnosis: FitDiagnosisSchema.optional(),
});
export type SubmitAssessmentInput = z.infer<typeof SubmitAssessmentInputSchema>;

export const SignAssessmentInputSchema = z.object({
  assessment_report_id: idSchema,
  signed_at: z
    .string()
    .refine((s) => !Number.isNaN(Date.parse(s)), "must be ISO date"),
});
export type SignAssessmentInput = z.infer<typeof SignAssessmentInputSchema>;
