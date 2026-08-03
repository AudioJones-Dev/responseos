import { describe, expect, test } from "vitest";
import { isAuthRequired } from "@/lib/auth/auth-required";

describe("isAuthRequired", () => {
  test.each(["1", "true", "TRUE", "yes", "on"])(
    "treats %o as auth-required",
    (value) => {
      expect(isAuthRequired({ RESPONSEOS_REQUIRE_AUTH: value })).toBe(true);
    },
  );

  test.each(["0", "false", "False", "FALSE", "", undefined])(
    "treats %o as not auth-required",
    (value) => {
      expect(isAuthRequired({ RESPONSEOS_REQUIRE_AUTH: value })).toBe(false);
    },
  );

  test("unset env preserves mock-first boot (ADR-0001)", () => {
    expect(isAuthRequired({})).toBe(false);
  });
});
