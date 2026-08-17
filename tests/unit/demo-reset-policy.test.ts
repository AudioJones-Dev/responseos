import { describe, expect, test } from "vitest";

import { assertDemoResetAllowed } from "@/lib/demo/resetPolicy";

describe("demo sandbox reset policy", () => {
  test("requires an explicit flag and refuses every production environment", () => {
    expect(() => assertDemoResetAllowed({})).toThrow(/RESPONSEOS_DEMO_RESET/);
    expect(() =>
      assertDemoResetAllowed({
        RESPONSEOS_DEMO_RESET: "true",
        NODE_ENV: "production",
      }),
    ).toThrow(/production/);
    expect(() =>
      assertDemoResetAllowed({
        RESPONSEOS_DEMO_RESET: "true",
        VERCEL_ENV: "production",
      }),
    ).toThrow(/production/);
    expect(() =>
      assertDemoResetAllowed({
        RESPONSEOS_DEMO_RESET: "true",
        NODE_ENV: "development",
      }),
    ).not.toThrow();
  });
});
