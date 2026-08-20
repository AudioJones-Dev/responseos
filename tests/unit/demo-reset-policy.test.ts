import { describe, expect, test } from "vitest";
import { assertDemoResetAllowed } from "@/lib/demo/resetPolicy";

describe("assertDemoResetAllowed", () => {
  test("requires the explicit reset flag", () => {
    expect(() => assertDemoResetAllowed({})).toThrow("RESPONSEOS_DEMO_RESET=true");
  });

  test("allows only the mock-staging lane", () => {
    expect(() =>
      assertDemoResetAllowed({ RESPONSEOS_DEMO_RESET: "true" }),
    ).toThrow("mock-staging");
  });

  test("refuses production even when enabled", () => {
    expect(() =>
      assertDemoResetAllowed({
        RESPONSEOS_DEMO_RESET: "true",
        RESPONSEOS_DEPLOYMENT_LANE: "mock-staging",
        VERCEL_ENV: "production",
      }),
    ).toThrow("disabled in production");
  });

  test("accepts an explicitly enabled mock staging lane", () => {
    expect(() =>
      assertDemoResetAllowed({
        RESPONSEOS_DEMO_RESET: "true",
        RESPONSEOS_DEPLOYMENT_LANE: "mock-staging",
        VERCEL_ENV: "preview",
      }),
    ).not.toThrow();
  });
});
