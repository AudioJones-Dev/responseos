import { describe, expect, test, vi } from "vitest";

import {
  certifyProtectedStagingNavigation,
  CLERK_DOCUMENT_REQUEST_HEADERS,
  deriveClerkTestAccountsOrigin,
  validateProtectedNavigationEvidence,
} from "@/scripts/validate-staging-protected-route-smoke.mjs";

const deploymentOrigin =
  "https://responseos-staging-mock-fwzvl66pv-audiojones.vercel.app";
const frontendApi = "in-swan-2470.clerk.accounts.dev";
const clerkPublishableKey = `pk_test_${Buffer.from(`${frontendApi}$`).toString("base64url")}`;
const clerkSignIn = "https://in-swan-2470.accounts.dev/sign-in";

const evidence = (overrides: Record<string, unknown> = {}) => ({
  route: "/admin",
  status: 307,
  location: clerkSignIn,
  ...overrides,
});

const validate = (overrides: Record<string, unknown> = {}) =>
  validateProtectedNavigationEvidence(evidence(overrides), {
    deploymentOrigin,
    clerkPublishableKey,
  });

describe("staging protected browser-navigation smoke", () => {
  test("derives the Clerk test Account Portal without exposing the key", () => {
    expect(deriveClerkTestAccountsOrigin(clerkPublishableKey)).toBe(
      "https://in-swan-2470.accounts.dev",
    );
  });

  test("accepts the resolved Clerk 7.6.1 anonymous document redirect", () => {
    expect(validate()).toEqual([]);
  });

  test.each([
    ["arbitrary redirect", { location: "https://example.com/sign-in" }],
    ["redirect loop", { location: `${deploymentOrigin}/admin` }],
    ["Production ResponseOS host", { location: "https://responseos.vercel.app/sign-in" }],
    [
      "Production return path",
      {
        location:
          "https://in-swan-2470.accounts.dev/sign-in?redirect_url=https%3A%2F%2Fresponseos.vercel.app%2Fadmin",
      },
    ],
    ["missing Location", { location: null }],
    ["document 404", { status: 404, location: null }],
    ["document 200", { status: 200, location: null }],
    ["document 500", { status: 500, location: null }],
    ["wrong Clerk path", { location: "https://in-swan-2470.accounts.dev/sign-up" }],
  ])("rejects %s", (_label, overrides) => {
    expect(validate(overrides).length).toBeGreaterThan(0);
  });

  test("does not treat a non-document 404 as certification", () => {
    expect(validate({ status: 404, location: null }).join(" ")).toContain(
      "HTTP 307",
    );
  });

  test("sends the exact Clerk document-classification headers without following redirects", async () => {
    const fetchImpl = vi.fn<
      (input: URL | RequestInfo, init?: RequestInit) => Promise<Response>
    >(async () =>
      new Response(null, {
        status: 307,
        headers: { location: clerkSignIn },
      }),
    );

    await certifyProtectedStagingNavigation({
      deploymentOrigin,
      clerkPublishableKey,
      automationBypassSecret: "test-bypass",
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(
      fetchImpl.mock.calls.map(([url]) => new URL(String(url)).pathname),
    ).toEqual(["/admin", "/client/dashboard"]);
    for (const [, init] of fetchImpl.mock.calls) {
      const headers = new Headers(init?.headers);
      expect(init?.redirect).toBe("manual");
      expect(headers.get("accept")).toBe(
        CLERK_DOCUMENT_REQUEST_HEADERS.accept,
      );
      expect(headers.get("sec-fetch-dest")).toBe("document");
      expect(headers.get("x-vercel-protection-bypass")).toBe("test-bypass");
    }
  });

  test("collects evidence for both routes before failing", async () => {
    const fetchImpl = vi.fn<
      (input: URL | RequestInfo, init?: RequestInit) => Promise<Response>
    >(async (input) => {
      const path = new URL(String(input)).pathname;
      return path === "/admin"
        ? new Response(null, { status: 404 })
        : new Response(null, {
            status: 307,
            headers: { location: clerkSignIn },
          });
    });

    await expect(
      certifyProtectedStagingNavigation({
        deploymentOrigin,
        clerkPublishableKey,
        automationBypassSecret: "test-bypass",
        fetchImpl,
      }),
    ).rejects.toThrow("/admin");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
