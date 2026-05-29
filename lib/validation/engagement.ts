import { z } from "zod";
import { centsSchema, idSchema } from "./common";

export const EngagementTierSchema = z.enum([
  "recovery_core",
  "recovery_pro",
  "recovery_performance",
]);
export type EngagementTier = z.infer<typeof EngagementTierSchema>;

export const EngagementStatusSchema = z.enum([
  "active",
  "paused",
  "cancelled",
  "completed",
]);

export const OutcomeFeeKindSchema = z.enum([
  "per_qualified_appointment",
  "per_verified_recovered_lead",
  "pct_recovered_revenue",
  "threshold_bonus",
]);

export const UsageModelSchema = z.enum([
  "bundled_with_cap",
  "passthrough_with_margin",
]);

/**
 * Tier ↔ price-range table per docs/pricing-and-onboarding.md.
 * Phase B validates fee bounds; Phase C surfaces the error.
 *
 * Range is inclusive lower bound, inclusive upper bound (or null for open-ended).
 */
const TIER_FEE_RANGES = {
  recovery_core: {
    setup_min: 250_000,
    setup_max: 400_000,
    monthly_min: 75_000,
    monthly_max: 125_000,
  },
  recovery_pro: {
    setup_min: 500_000,
    setup_max: 850_000,
    monthly_min: 150_000,
    monthly_max: 250_000,
  },
  recovery_performance: {
    setup_min: 850_000,
    setup_max: null,
    monthly_min: 250_000,
    monthly_max: null,
  },
} as const;

export const CreateEngagementInputSchema = z
  .object({
    account_id: idSchema,
    assessment_report_id: idSchema,
    tier: EngagementTierSchema,
    setup_fee_cents: centsSchema,
    monthly_fee_cents: centsSchema,
    outcome_fee_kind: OutcomeFeeKindSchema.optional(),
    outcome_fee_terms_json: z.record(z.string(), z.unknown()).optional(),
    usage_model: UsageModelSchema,
    included_voice_minutes: z.number().int().nonnegative().optional(),
    passthrough_margin_pct: z.number().int().min(0).max(100).optional(),
    is_founding_pilot: z.boolean().optional(),
    pilot_ends_at: z
      .string()
      .refine((s) => !Number.isNaN(Date.parse(s)), "must be ISO date")
      .optional(),
    signed_at: z
      .string()
      .refine((s) => !Number.isNaN(Date.parse(s)), "must be ISO date"),
  })
  .superRefine((value, ctx) => {
    const range = TIER_FEE_RANGES[value.tier];

    if (
      value.setup_fee_cents < range.setup_min ||
      (range.setup_max !== null && value.setup_fee_cents > range.setup_max)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["setup_fee_cents"],
        message: "outside allowed range for tier",
        params: {
          allowed_range: { min: range.setup_min, max: range.setup_max },
        },
      });
    }

    if (
      value.monthly_fee_cents < range.monthly_min ||
      (range.monthly_max !== null && value.monthly_fee_cents > range.monthly_max)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["monthly_fee_cents"],
        message: "outside allowed range for tier",
        params: {
          allowed_range: { min: range.monthly_min, max: range.monthly_max },
        },
      });
    }

    if (
      value.usage_model === "bundled_with_cap" &&
      value.included_voice_minutes === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["included_voice_minutes"],
        message: "required when usage_model = bundled_with_cap",
      });
    }
    if (
      value.usage_model === "passthrough_with_margin" &&
      value.passthrough_margin_pct === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["passthrough_margin_pct"],
        message: "required when usage_model = passthrough_with_margin",
      });
    }
  });
export type CreateEngagementInput = z.infer<typeof CreateEngagementInputSchema>;
