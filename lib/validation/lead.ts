import { z } from "zod";
import { idSchema } from "./common";

export const LeadEventStatusSchema = z.enum([
  "new",
  "qualified",
  "unqualified",
  "booked",
  "quoted",
  "won",
  "lost",
  "archived",
]);
export type LeadEventStatusValidated = z.infer<typeof LeadEventStatusSchema>;

export const TransitionLeadStatusInputSchema = z.object({
  lead_event_id: idSchema,
  to: LeadEventStatusSchema,
  notes: z.string().max(2000).optional(),
});
export type TransitionLeadStatusInput = z.infer<
  typeof TransitionLeadStatusInputSchema
>;

/**
 * Inbound qualify shape — mirrors the existing
 * lib/scoring/leadQualificationScore.ts contract. Score is recomputed
 * server-side per spec §6; client-supplied score is ignored.
 */
export const QualifyLeadInputSchema = z.object({
  lead_event_id: idSchema,
  serviceAreaMatch: z.boolean(),
  urgency: z.enum(["low", "medium", "high", "urgent"]),
  serviceRequested: z.string().max(500).optional(),
  budgetTimeline: z
    .enum([
      "unspecified",
      "within_30_days",
      "within_60_days",
      "within_90_days",
      "flexible",
    ])
    .optional(),
  decisionMaker: z.boolean().optional(),
});
export type QualifyLeadInput = z.infer<typeof QualifyLeadInputSchema>;
