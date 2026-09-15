import { describe, expect, test } from "vitest";
import { leadQualificationScore } from "@/lib/scoring/leadQualificationScore";
import {
  URGENCY_FROM_TIMELINE,
  qualificationInputFromFacts,
  type QualificationTimeline,
} from "@/lib/scoring/qualificationFacts";

describe("URGENCY_FROM_TIMELINE", () => {
  test.each<[QualificationTimeline, string]>([
    ["same_day", "urgent"],
    ["this_week", "high"],
    ["this_month", "medium"],
    ["unknown", "low"],
  ])("%s → %s", (timeline, urgency) => {
    expect(URGENCY_FROM_TIMELINE[timeline]).toBe(urgency);
  });

  test("is frozen and covers every timeline exactly once", () => {
    expect(Object.isFrozen(URGENCY_FROM_TIMELINE)).toBe(true);
    expect(Object.keys(URGENCY_FROM_TIMELINE).sort()).toEqual(
      ["same_day", "this_month", "this_week", "unknown"],
    );
  });

  test("urgency strictly increases with a sooner timeline", () => {
    const score = (timeline: QualificationTimeline) =>
      leadQualificationScore(
        qualificationInputFromFacts({
          serviceAreaMatch: false,
          timeline,
          serviceNeeded: null,
          decisionMaker: null,
        }),
      );
    expect(score("unknown")).toBeLessThan(score("this_month"));
    expect(score("this_month")).toBeLessThan(score("this_week"));
    expect(score("this_week")).toBeLessThan(score("same_day"));
  });
});

describe("qualificationInputFromFacts", () => {
  test("maps nulls to absent optionals rather than falsy values", () => {
    expect(
      qualificationInputFromFacts({
        serviceAreaMatch: true,
        timeline: "unknown",
        serviceNeeded: null,
        decisionMaker: null,
      }),
    ).toEqual({
      serviceAreaMatch: true,
      urgency: "low",
      serviceRequested: undefined,
      decisionMaker: undefined,
    });
  });

  test("never sets budgetTimeline: the provider's budget_range is free text", () => {
    const input = qualificationInputFromFacts({
      serviceAreaMatch: true,
      timeline: "same_day",
      serviceNeeded: "burst pipe",
      decisionMaker: true,
    });
    expect("budgetTimeline" in input).toBe(false);
  });

  test("scores exactly what the facts support, never a provider number", () => {
    const facts = {
      serviceAreaMatch: false,
      timeline: "this_month" as const,
      serviceNeeded: "Operations assessment",
      decisionMaker: null,
    };
    const score = leadQualificationScore(qualificationInputFromFacts(facts));
    expect(score).toBe(Math.round(25 * 0.6 + 10));
  });
});
