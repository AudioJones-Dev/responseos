import { describe, expect, test } from "vitest";
import {
  calculateMonthlyRevenueExposure,
  isRevenueExposureInputValid,
} from "@/lib/revenue/calculateRevenueExposure";

describe("calculateMonthlyRevenueExposure", () => {
  test("calculates and rounds a monthly planning estimate", () => {
    expect(
      calculateMonthlyRevenueExposure({
        monthlyMissedCalls: 20,
        averageJobValueUsd: 850,
        closeRatePct: 30,
      }),
    ).toBe(5100);

    expect(
      calculateMonthlyRevenueExposure({
        monthlyMissedCalls: 3,
        averageJobValueUsd: 99.99,
        closeRatePct: 33,
      }),
    ).toBe(99);
  });

  test("accepts zero values", () => {
    expect(
      calculateMonthlyRevenueExposure({
        monthlyMissedCalls: 0,
        averageJobValueUsd: 850,
        closeRatePct: 30,
      }),
    ).toBe(0);
  });

  test("treats decimal close rates as valid planning inputs", () => {
    expect(
      isRevenueExposureInputValid({
        monthlyMissedCalls: 12,
        averageJobValueUsd: 850,
        closeRatePct: 33.3,
      }),
    ).toBe(true);

    expect(
      calculateMonthlyRevenueExposure({
        monthlyMissedCalls: 12,
        averageJobValueUsd: 850,
        closeRatePct: 33.3,
      }),
    ).toBe(3397);
  });

  test("rejects invalid inputs", () => {
    expect(() =>
      calculateMonthlyRevenueExposure({
        monthlyMissedCalls: 1.5,
        averageJobValueUsd: 850,
        closeRatePct: 30,
      }),
    ).toThrow("monthlyMissedCalls must be an integer");

    expect(() =>
      calculateMonthlyRevenueExposure({
        monthlyMissedCalls: 20,
        averageJobValueUsd: -1,
        closeRatePct: 30,
      }),
    ).toThrow("averageJobValueUsd must be a non-negative number");

    expect(() =>
      calculateMonthlyRevenueExposure({
        monthlyMissedCalls: 20,
        averageJobValueUsd: 850,
        closeRatePct: 101,
      }),
    ).toThrow("closeRatePct must be between 0 and 100");
  });
});
