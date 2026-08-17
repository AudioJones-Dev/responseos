export interface RevenueExposureInput {
  monthlyMissedCalls: number;
  averageJobValueUsd: number;
  closeRatePct: number;
}

export function calculateMonthlyRevenueExposure({
  monthlyMissedCalls,
  averageJobValueUsd,
  closeRatePct,
}: RevenueExposureInput): number {
  if (!Number.isFinite(monthlyMissedCalls) || monthlyMissedCalls < 0) {
    throw new Error("monthlyMissedCalls must be a non-negative number");
  }
  if (!Number.isInteger(monthlyMissedCalls)) {
    throw new Error("monthlyMissedCalls must be an integer");
  }
  if (!Number.isFinite(averageJobValueUsd) || averageJobValueUsd < 0) {
    throw new Error("averageJobValueUsd must be a non-negative number");
  }
  if (
    !Number.isFinite(closeRatePct) ||
    closeRatePct < 0 ||
    closeRatePct > 100
  ) {
    throw new Error("closeRatePct must be between 0 and 100");
  }

  return Math.round(
    monthlyMissedCalls * averageJobValueUsd * (closeRatePct / 100),
  );
}
