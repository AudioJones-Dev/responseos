import { describe, expect, test } from "vitest";
import { isPublicPath } from "@/lib/auth/route-protection";

describe("isPublicPath", () => {
  test.each([
    "/",
    "/pricing",
    "/demo",
    "/api/health",
    "/sign-in",
    "/sign-in/factor-one",
    "/sign-up",
    "/sign-up/verify",
    "/industries",
    "/industries/contractors",
    "/api/webhooks",
    "/api/webhooks/clerk",
    "/api/webhooks/stripe",
  ])("treats %s as public", (path) => {
    expect(isPublicPath(path)).toBe(true);
  });

  test.each([
    "/client",
    "/client/dashboard",
    "/admin",
    "/audit",
    "/api/quotes",
    "/api/reports/revenue",
    "/api/auth/session",
    // prefix look-alikes must NOT leak public status
    "/sign-in-evil",
    "/industries-x",
    "/api/webhooks-secret",
    "/pricing/internal",
  ])("treats %s as protected", (path) => {
    expect(isPublicPath(path)).toBe(false);
  });
});
