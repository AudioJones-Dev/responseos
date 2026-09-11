import { describe, expect, test } from "vitest";
import {
  FLORIDA_RAMP_LIFT_BUSINESS_NAME,
  floridaRampLiftOperatingConfiguration,
} from "@/lib/config/clients/florida-ramp-lift";
import {
  OPERATING_CONFIGURATION_REQUIREMENTS,
  evaluateOperatingConfiguration,
} from "@/lib/agentExecution/operatingConfiguration";

describe("Florida Ramp & Lift operating-configuration skeleton", () => {
  const memory = floridaRampLiftOperatingConfiguration({
    accountId: "account-frl-test",
    generatedAt: new Date("2026-09-11T12:00:00.000Z"),
  });

  test("is exactly the approved skeleton: the caller's account id, no facts, and only the five unknowns as free text", () => {
    expect(memory).toEqual({
      schemaVersion: "prospect-bootstrap.v1",
      bootstrapId: null,
      accountId: "account-frl-test",
      generatedAt: "2026-09-11T12:00:00.000Z",
      businessProfile: [],
      services: [],
      locations: [],
      operatingHours: [],
      serviceAreas: [],
      faqs: [],
      policies: [],
      contactPaths: [],
      brandVoice: [],
      unknowns: [
        "operating_hours.weekly has no approved value.",
        "operating_hours.holidays has no approved value.",
        "service_area.coverage has no approved value.",
        "contact.escalation has no approved value.",
        "policy.consent has no approved value.",
      ],
      conflicts: [],
      agentBoundaries: [],
      sourceManifest: [],
    });
  });

  test("carries only the business name as identity", () => {
    expect(FLORIDA_RAMP_LIFT_BUSINESS_NAME).toBe("Florida Ramp & Lift");
  });

  test("is not ready for a supervised pilot", () => {
    expect(evaluateOperatingConfiguration(memory, "SUPERVISED_PILOT")).toEqual({
      ready: false,
      missing: [...OPERATING_CONFIGURATION_REQUIREMENTS.SUPERVISED_PILOT],
      conflicts: [],
    });
  });
});
