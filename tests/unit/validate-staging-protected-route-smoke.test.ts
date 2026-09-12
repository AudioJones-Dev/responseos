import { describe, expect, test, vi } from "vitest";

import {
  certifyProtectedStagingNavigation,
  classifyClerkAuthRedirect,
  CLERK_AUTH_REDIRECT_CLASSIFICATION,
  CLERK_DOCUMENT_REQUEST_HEADERS,
  deriveClerkFrontendApiOrigin,
  validateClerkEnvironment,
} from "@/scripts/validate-staging-protected-route-smoke.mjs";

const deploymentOrigin =
  "https://responseos-staging-mock-fwzvl66pv-audiojones.vercel.app";
const managedAlias =
  "https://responseos-staging-mock-env-staging-audiojones.vercel.app";
const frontendApi = "in-swan-2470.clerk.accounts.dev";
const frontendApiOrigin = `https://${frontendApi}`;
const clerkPublishableKey = `pk_test_${Buffer.from(`${frontendApi}$`).toString("base64url")}`;
const clerkSignIn = "https://in-swan-2470.accounts.dev/sign-in";

const clerkEnvironment = (overrides: Record<string, unknown> = {}) => ({
  object: "environment",
  auth_config: { test_mode: true },
  display_config: {
    instance_environment_type: "development",
    sign_in_url: clerkSignIn,
  },
  ...overrides,
});

const context = {
  deploymentOrigin,
  frontendApiOrigin,
  accountPortalSignInUrl: clerkSignIn,
};

const evidence = (overrides: Record<string, unknown> = {}) => ({
  route: "/admin",
  status: 307,
  location: clerkSignIn,
  ...overrides,
});

function handshakeLocation(
  route = "/admin",
  overrides: Record<string, string | null> = {},
) {
  const url = new URL("/v1/client/handshake", frontendApiOrigin);
  url.searchParams.set("redirect_url", `${deploymentOrigin}${route}`);
  url.searchParams.set("__clerk_api_version", "2026-05-12");
  url.searchParams.set("suffixed_cookies", "false");
  url.searchParams.set("__clerk_hs_reason", "session-token-and-uat-missing");
  url.searchParams.set("format", "nonce");
  for (const [name, value] of Object.entries(overrides)) {
    if (value === null) url.searchParams.delete(name);
    else url.searchParams.set(name, value);
  }
  return url.href;
}

function classify(overrides: Record<string, unknown> = {}) {
  return classifyClerkAuthRedirect(evidence(overrides), context);
}

describe("Clerk development environment evidence", () => {
  test("derives the exact development FAPI from a pk_test_ key", () => {
    expect(deriveClerkFrontendApiOrigin(clerkPublishableKey)).toBe(
      frontendApiOrigin,
    );
  });

  test.each([
    ["live key", `pk_live_${Buffer.from(`${frontendApi}$`).toString("base64url")}`],
    ["malformed key", "pk_test_not-valid"],
    ["wrong FAPI", `pk_test_${Buffer.from("example.com$").toString("base64url")}`],
  ])("rejects a %s", (_label, key) => {
    expect(() => deriveClerkFrontendApiOrigin(key)).toThrow();
  });

  test("accepts exact test/development environment evidence", () => {
    expect(
      validateClerkEnvironment(clerkEnvironment(), {
        frontendApiOrigin,
        deploymentOrigin,
      }),
    ).toEqual({
      accountPortalSignInUrl: clerkSignIn,
      developmentEvidence: "test-mode",
    });
  });

  test("accepts the resolved schema's development instance evidence without test_mode", () => {
    expect(
      validateClerkEnvironment(
        clerkEnvironment({
          auth_config: {},
          display_config: {
            instance_environment_type: "development",
            sign_in_url: clerkSignIn,
          },
        }),
        { frontendApiOrigin, deploymentOrigin },
      ).developmentEvidence,
    ).toBe("development-instance");
  });

  test.each([
    ["test_mode false", clerkEnvironment({ auth_config: { test_mode: false } })],
    [
      "missing sign_in_url",
      clerkEnvironment({
        display_config: { instance_environment_type: "development" },
      }),
    ],
    [
      "malformed sign_in_url",
      clerkEnvironment({
        display_config: {
          instance_environment_type: "development",
          sign_in_url: "not-a-url",
        },
      }),
    ],
    [
      "Production ResponseOS URL",
      clerkEnvironment({
        display_config: {
          instance_environment_type: "development",
          sign_in_url: "https://responseos.vercel.app/sign-in",
        },
      }),
    ],
  ])("rejects %s", (_label, environment) => {
    expect(() =>
      validateClerkEnvironment(environment, {
        frontendApiOrigin,
        deploymentOrigin,
      }),
    ).toThrow();
  });
});

describe("Clerk Account Portal redirect classification", () => {
  test("accepts the exact configured Account Portal sign-in", () => {
    expect(classify()).toMatchObject({
      classification:
        CLERK_AUTH_REDIRECT_CLASSIFICATION.AccountPortalSignIn,
      errors: [],
    });
  });

  test("accepts an exact immutable return URL", () => {
    expect(
      classify({
        location: `${clerkSignIn}?redirect_url=${encodeURIComponent(`${deploymentOrigin}/admin`)}`,
      }).errors,
    ).toEqual([]);
  });

  test.each([
    ["arbitrary accounts.dev", "https://other.accounts.dev/sign-in"],
    ["guessed Account Portal", "https://in-swan-2470.accounts.dev/sign-in", "https://configured.accounts.dev/sign-in"],
    ["wrong path", "https://in-swan-2470.accounts.dev/sign-up"],
    ["HTTP", "http://in-swan-2470.accounts.dev/sign-in"],
    ["credentials", "https://user@in-swan-2470.accounts.dev/sign-in"],
    ["non-standard port", "https://in-swan-2470.accounts.dev:8443/sign-in"],
  ])("rejects %s", (_label, location, configured = clerkSignIn) => {
    expect(
      classifyClerkAuthRedirect(evidence({ location }), {
        ...context,
        accountPortalSignInUrl: configured,
      }).errors.length,
    ).toBeGreaterThan(0);
  });

  test.each([
    "https://responseos.vercel.app/admin",
    `${deploymentOrigin}/client/dashboard`,
    `${managedAlias}/admin`,
    `http://${new URL(deploymentOrigin).host}/admin`,
  ])("rejects unsafe return URL %s", (returnUrl) => {
    expect(
      classify({
        location: `${clerkSignIn}?redirect_url=${encodeURIComponent(returnUrl)}`,
      }).errors.length,
    ).toBeGreaterThan(0);
  });
});

describe("Clerk FAPI handshake classification", () => {
  test.each(["/admin", "/client/dashboard"])(
    "accepts the exact FAPI handshake returning to %s",
    (route) => {
      expect(
        classifyClerkAuthRedirect(
          evidence({
            route,
            location: handshakeLocation(route),
            authStatus: "handshake",
            authReason: "session-token-and-uat-missing",
          }),
          context,
        ),
      ).toMatchObject({
        classification:
          CLERK_AUTH_REDIRECT_CLASSIFICATION.FrontendApiHandshake,
        errors: [],
        evidence: {
          destination: "canonical-clerk-fapi",
          path: "/v1/client/handshake",
          redirectOrigin: "immutable-staging",
          redirectPath: route,
        },
      });
    },
  );

  test.each([
    [
      "wrong FAPI instance",
      handshakeLocation().replace(frontendApi, "other.clerk.accounts.dev"),
    ],
    ["missing redirect_url", handshakeLocation("/admin", { redirect_url: null })],
    [
      "Production redirect_url",
      handshakeLocation("/admin", {
        redirect_url: "https://responseos.vercel.app/admin",
      }),
    ],
    [
      "managed alias redirect_url",
      handshakeLocation("/admin", { redirect_url: `${managedAlias}/admin` }),
    ],
    [
      "wrong protected route",
      handshakeLocation("/admin", {
        redirect_url: `${deploymentOrigin}/client/dashboard`,
      }),
    ],
    ["missing format", handshakeLocation("/admin", { format: null })],
    ["empty format", handshakeLocation("/admin", { format: "" })],
    ["unknown format", handshakeLocation("/admin", { format: "token" })],
    [
      "unknown handshake path",
      handshakeLocation().replace("/v1/client/handshake", "/v1/client/unknown"),
    ],
    ["malformed URL", "not-a-url"],
  ])("rejects %s", (_label, location) => {
    expect(classify({ location }).errors.length).toBeGreaterThan(0);
  });

  test("rejects inconsistent Clerk handshake headers when returned", () => {
    expect(
      classify({
        location: handshakeLocation(),
        authStatus: "signed-out",
        authReason: "unknown-reason",
      }).errors.length,
    ).toBeGreaterThan(0);
  });

  test("rejects duplicate handshake redirect_url evidence", () => {
    const url = new URL(handshakeLocation());
    url.searchParams.append("redirect_url", `${deploymentOrigin}/admin`);
    expect(classify({ location: url.href }).errors.length).toBeGreaterThan(0);
  });

  test("rejects duplicate handshake format evidence", () => {
    const url = new URL(handshakeLocation());
    url.searchParams.append("format", "nonce");
    expect(classify({ location: url.href }).errors.length).toBeGreaterThan(0);
  });
});

describe("hosted protected-route certification", () => {
  test.each([200, 401, 403, 404, 500])(
    "rejects document-mode HTTP %s",
    (status) => {
      expect(classify({ status, location: null }).errors.join(" ")).toContain(
        "HTTP 307",
      );
    },
  );

  test("fetches Clerk environment without the Vercel bypass secret and probes both routes", async () => {
    const fetchImpl = vi.fn<
      (input: URL | RequestInfo, init?: RequestInit) => Promise<Response>
    >(async (input) => {
      const url = new URL(String(input));
      if (url.origin === frontendApiOrigin) {
        return Response.json(clerkEnvironment());
      }
      return new Response(null, {
        status: 307,
        headers: {
          location: handshakeLocation(url.pathname),
          "x-clerk-auth-status": "handshake",
          "x-clerk-auth-reason": "session-token-and-uat-missing",
        },
      });
    });

    const results = await certifyProtectedStagingNavigation({
      deploymentOrigin,
      clerkPublishableKey,
      automationBypassSecret: "test-bypass",
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    const [environmentCall, ...routeCalls] = fetchImpl.mock.calls;
    expect(new URL(String(environmentCall[0])).href).toBe(
      `${frontendApiOrigin}/v1/environment`,
    );
    expect(environmentCall[1]?.method).toBe("GET");
    expect(environmentCall[1]?.redirect).toBe("error");
    expect(
      new Headers(environmentCall[1]?.headers).has(
        "x-vercel-protection-bypass",
      ),
    ).toBe(false);

    expect(
      routeCalls.map(([url]) => new URL(String(url)).pathname),
    ).toEqual(["/admin", "/client/dashboard"]);
    for (const [, init] of routeCalls) {
      const headers = new Headers(init?.headers);
      expect(init?.method).toBe("GET");
      expect(init?.redirect).toBe("manual");
      expect(headers.get("accept")).toBe(
        CLERK_DOCUMENT_REQUEST_HEADERS.accept,
      );
      expect(headers.get("sec-fetch-dest")).toBe("document");
      expect(headers.get("x-vercel-protection-bypass")).toBe("test-bypass");
    }
    expect(results.map(({ route }) => route)).toEqual([
      "/admin",
      "/client/dashboard",
    ]);
  });

  test("collects evidence for both routes before failing", async () => {
    const fetchImpl = vi.fn<
      (input: URL | RequestInfo, init?: RequestInit) => Promise<Response>
    >(async (input) => {
      const url = new URL(String(input));
      if (url.origin === frontendApiOrigin) return Response.json(clerkEnvironment());
      return url.pathname === "/admin"
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
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(
      fetchImpl.mock.calls
        .map(([input]) => new URL(String(input)).pathname)
        .filter((path) => path !== "/v1/environment"),
    ).toEqual(["/admin", "/client/dashboard"]);
  });

  test("never logs raw Location or handshake query values", async () => {
    const opaque = "session-material-must-not-be-logged";
    const fetchImpl = vi.fn<
      (input: URL | RequestInfo, init?: RequestInit) => Promise<Response>
    >(async (input) => {
      const requestUrl = new URL(String(input));
      if (requestUrl.origin === frontendApiOrigin) {
        return Response.json(clerkEnvironment());
      }
      return new Response(null, {
        status: 307,
        headers: {
          location: `${handshakeLocation(requestUrl.pathname)}&__session=${opaque}`,
          "x-clerk-auth-status": "handshake",
        },
      });
    });
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await certifyProtectedStagingNavigation({
      deploymentOrigin,
      clerkPublishableKey,
      automationBypassSecret: "test-bypass",
      fetchImpl,
    });

    const output = log.mock.calls.flat().join(" ");
    expect(output).not.toContain(opaque);
    expect(output).not.toContain(clerkPublishableKey);
    expect(output).toContain("CLERK_FAPI_HANDSHAKE");
    log.mockRestore();
  });

  test.each([
    ["request failure", () => Promise.reject(new Error("offline"))],
    ["non-success response", () => Promise.resolve(new Response(null, { status: 503 }))],
    ["invalid JSON", () => Promise.resolve(new Response("not-json"))],
  ])("SAFE STOPs when the Clerk environment has a %s", async (_label, response) => {
    await expect(
      certifyProtectedStagingNavigation({
        deploymentOrigin,
        clerkPublishableKey,
        automationBypassSecret: "test-bypass",
        fetchImpl: vi.fn(response),
      }),
    ).rejects.toThrow("Clerk Frontend API environment");
  });
});
