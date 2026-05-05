/**
 * Estimated Recovered Revenue (cents) =
 *   Qualified Recovered Leads × Average Job Value × Estimated Close Rate.
 *
 * Returns an integer (cents). Throws on invalid input.
 */
export function calculateRecoveredRevenue(
  qualifiedRecoveredLeads: number,
  averageJobValueCents: number,
  estimatedCloseRate: number,
): number {
  if (!Number.isFinite(qualifiedRecoveredLeads) || qualifiedRecoveredLeads < 0) {
    throw new Error("qualifiedRecoveredLeads must be a non-negative number");
  }
  if (!Number.isFinite(averageJobValueCents) || averageJobValueCents < 0) {
    throw new Error("averageJobValueCents must be a non-negative number");
  }
  if (
    !Number.isFinite(estimatedCloseRate) ||
    estimatedCloseRate < 0 ||
    estimatedCloseRate > 1
  ) {
    throw new Error("estimatedCloseRate must be between 0 and 1");
  }

  return Math.round(
    qualifiedRecoveredLeads * averageJobValueCents * estimatedCloseRate,
  );
}
