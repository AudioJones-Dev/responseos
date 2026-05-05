/**
 * ROI Multiple = Estimated Recovered Revenue / Monthly System Cost.
 *
 * Returns null when monthly cost is zero (undefined ratio) so the UI can
 * render a non-numeric label instead of Infinity. Throws on negative input.
 */
export function calculateRoiMultiple(
  recoveredRevenueCents: number,
  monthlySystemCostCents: number,
): number | null {
  if (!Number.isFinite(recoveredRevenueCents) || recoveredRevenueCents < 0) {
    throw new Error("recoveredRevenueCents must be a non-negative number");
  }
  if (!Number.isFinite(monthlySystemCostCents) || monthlySystemCostCents < 0) {
    throw new Error("monthlySystemCostCents must be a non-negative number");
  }

  if (monthlySystemCostCents === 0) return null;

  return recoveredRevenueCents / monthlySystemCostCents;
}
