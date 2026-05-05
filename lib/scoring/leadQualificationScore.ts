export interface LeadQualificationInput {
  serviceAreaMatch: boolean;
  urgency: "low" | "medium" | "high" | "urgent";
  serviceRequested?: string;
  budgetTimeline?:
    | "unspecified"
    | "within_30_days"
    | "within_60_days"
    | "within_90_days"
    | "flexible";
  decisionMaker?: boolean;
}

const URGENCY_WEIGHT: Record<LeadQualificationInput["urgency"], number> = {
  low: 0.25,
  medium: 0.6,
  high: 0.85,
  urgent: 1,
};

const BUDGET_WEIGHT: Record<
  NonNullable<LeadQualificationInput["budgetTimeline"]>,
  number
> = {
  within_30_days: 1,
  within_60_days: 0.7,
  within_90_days: 0.5,
  flexible: 0.3,
  unspecified: 0,
};

/**
 * Returns a 0..100 qualification score.
 *
 * Weights: serviceAreaMatch=30, urgency=25, decisionMaker=20,
 * budgetTimeline=15, serviceRequested-known=10. Total = 100.
 */
export function leadQualificationScore(input: LeadQualificationInput): number {
  let score = 0;

  if (input.serviceAreaMatch) score += 30;
  score += 25 * URGENCY_WEIGHT[input.urgency];
  if (input.decisionMaker) score += 20;
  if (input.budgetTimeline) score += 15 * BUDGET_WEIGHT[input.budgetTimeline];
  if (input.serviceRequested && input.serviceRequested.trim().length > 0) {
    score += 10;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}
