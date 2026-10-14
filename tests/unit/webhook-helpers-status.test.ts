import { describe, expect, test } from "vitest";
import { statusForCode } from "@/lib/providers/webhook-helpers";

describe("statusForCode", () => {
  test.each([
    "number_not_available",
    "evergreen_number_forbidden",
    "provider_number_mismatch",
    "qualification_profile_invalid",
    "qualification_snapshot_missing",
    "qualification_snapshot_invalid",
    "qualification_configuration_incomplete",
  ])("maps the qualification precondition %s to 409", (code) => {
    expect(statusForCode(code)).toBe(409);
  });

  test("keeps unknown codes as server errors", () => {
    expect(statusForCode("unexpected_failure")).toBe(500);
  });
});
