import fs from "node:fs";
import { pathToFileURL } from "node:url";

import { CANONICAL_STAGING_VERCEL } from "./staging-vercel-custom-environment.mjs";

export const PROTECTED_STAGING_ROUTES = Object.freeze([
  "/admin",
  "/client/dashboard",
]);

export const CLERK_DOCUMENT_REQUEST_HEADERS = Object.freeze({
  accept: "text/html,application/xhtml+xml",
  "sec-fetch-dest": "document",
});

export const CLERK_AUTH_REDIRECT_CLASSIFICATION = Object.freeze({
  AccountPortalSignIn: "CLERK_ACCOUNT_PORTAL_SIGN_IN",
  FrontendApiHandshake: "CLERK_FAPI_HANDSHAKE",
});

const EXPECTED_REDIRECT_STATUS = 307;
const CLERK_HANDSHAKE_PATH = "/v1/client/handshake";
const IMMUTABLE_VERCEL_HOST =
  /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.vercel\.app$/;
const CLERK_HANDSHAKE_REASONS = new Set([
  "client-uat-but-no-session-token",
  "dev-browser-missing",
  "dev-browser-sync",
  "primary-responds-to-syncing",
  "primary-domain-cross-origin-sync",
  "satellite-needs-syncing",
  "session-token-and-uat-missing",
  "session-token-missing",
  "session-token-expired",
  "session-token-iat-before-client-uat",
  "session-token-nbf",
  "session-token-iat-in-the-future",
  "session-token-but-no-client-uat",
  "active-organization-mismatch",
  "token-type-mismatch",
  "unexpected-error",
]);

function parseUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isCredentialFreeTlsUrl(url) {
  return (
    url?.protocol === "https:" &&
    !url.username &&
    !url.password &&
    !url.port
  );
}

export function deriveClerkFrontendApiOrigin(publishableKey) {
  if (
    typeof publishableKey !== "string" ||
    !/^pk_test_[A-Za-z0-9+/_-]+={0,2}$/.test(publishableKey)
  ) {
    throw new Error("Staging Clerk publishable key must be a valid test-mode key");
  }

  let decoded;
  try {
    decoded = Buffer.from(
      publishableKey.slice("pk_test_".length),
      "base64url",
    ).toString("utf8");
  } catch {
    throw new Error("Staging Clerk publishable key cannot be decoded");
  }

  if (!decoded.endsWith("$") || decoded.slice(0, -1).includes("$")) {
    throw new Error("Staging Clerk publishable key has invalid frontend API evidence");
  }

  const frontendApi = decoded.slice(0, -1);
  const frontendUrl = parseUrl(`https://${frontendApi}`);
  if (
    !isCredentialFreeTlsUrl(frontendUrl) ||
    frontendUrl.hostname !== frontendApi ||
    frontendUrl.pathname !== "/" ||
    frontendUrl.search ||
    frontendUrl.hash ||
    !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.clerk\.accounts\.dev$/.test(
      frontendApi,
    )
  ) {
    throw new Error("Staging Clerk frontend API is not a development instance");
  }

  return frontendUrl.origin;
}

function validateDeploymentOrigin(value) {
  const url = parseUrl(value);
  if (
    !isCredentialFreeTlsUrl(url) ||
    !IMMUTABLE_VERCEL_HOST.test(url.hostname) ||
    url.hostname === CANONICAL_STAGING_VERCEL.managedEnvironmentAlias ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    return null;
  }
  return url;
}

function validateExactImmutableReturnUrl(value, deploymentUrl, route) {
  const returnUrl = parseUrl(value);
  return Boolean(
    isCredentialFreeTlsUrl(returnUrl) &&
      returnUrl.origin === deploymentUrl.origin &&
      returnUrl.pathname === route &&
      !returnUrl.search &&
      !returnUrl.hash,
  );
}

export function validateClerkEnvironment(
  environment,
  { frontendApiOrigin, deploymentOrigin },
) {
  const deploymentUrl = validateDeploymentOrigin(deploymentOrigin);
  if (!deploymentUrl) {
    throw new Error("Clerk environment validation requires an immutable staging origin");
  }
  const frontendUrl = parseUrl(frontendApiOrigin);
  if (
    !isCredentialFreeTlsUrl(frontendUrl) ||
    !frontendUrl.hostname.endsWith(".clerk.accounts.dev")
  ) {
    throw new Error("Clerk environment validation requires the canonical development FAPI");
  }
  if (!environment || typeof environment !== "object" || Array.isArray(environment)) {
    throw new Error("Clerk Frontend API environment response is malformed");
  }

  const reportedTestMode = environment.auth_config?.test_mode;
  const instanceEnvironmentType =
    environment.display_config?.instance_environment_type;
  if (reportedTestMode === false) {
    throw new Error("Clerk Frontend API environment is not in test mode");
  }
  if (
    reportedTestMode !== true &&
    instanceEnvironmentType !== "development"
  ) {
    throw new Error("Clerk Frontend API environment lacks development-mode evidence");
  }

  const signInUrl = parseUrl(environment.display_config?.sign_in_url);
  if (
    !isCredentialFreeTlsUrl(signInUrl) ||
    !signInUrl.hostname.endsWith(".accounts.dev") ||
    signInUrl.hostname.endsWith(".clerk.accounts.dev") ||
    !/^\/sign-in\/?$/.test(signInUrl.pathname) ||
    signInUrl.search ||
    signInUrl.hash ||
    signInUrl.hostname === deploymentUrl.hostname ||
    signInUrl.hostname === CANONICAL_STAGING_VERCEL.managedEnvironmentAlias
  ) {
    throw new Error(
      "Clerk Frontend API environment does not expose a safe development Account Portal sign-in URL",
    );
  }

  return {
    accountPortalSignInUrl: signInUrl.href,
    developmentEvidence:
      reportedTestMode === true ? "test-mode" : "development-instance",
  };
}

export function validateClerkAccountPortalRedirect(
  redirectUrl,
  { accountPortalSignInUrl, deploymentUrl, route },
) {
  const configuredSignIn = parseUrl(accountPortalSignInUrl);
  const errors = [];
  if (
    !isCredentialFreeTlsUrl(redirectUrl) ||
    !configuredSignIn ||
    redirectUrl.origin !== configuredSignIn.origin ||
    redirectUrl.pathname !== configuredSignIn.pathname ||
    redirectUrl.hash
  ) {
    errors.push(
      "Anonymous document navigation did not reach the configured Clerk Account Portal sign-in path",
    );
    return errors;
  }

  const returnBackValues = redirectUrl.searchParams.getAll("redirect_url");
  if (
    returnBackValues.length > 1 ||
    (returnBackValues.length === 1 &&
      !validateExactImmutableReturnUrl(returnBackValues[0], deploymentUrl, route))
  ) {
    errors.push("Clerk sign-in return path must preserve the immutable protected route");
  }
  return errors;
}

export function validateClerkHandshakeRedirect(
  redirectUrl,
  { frontendApiOrigin, deploymentUrl, route, authStatus, authReason },
) {
  const errors = [];
  if (
    !isCredentialFreeTlsUrl(redirectUrl) ||
    redirectUrl.origin !== frontendApiOrigin ||
    redirectUrl.pathname !== CLERK_HANDSHAKE_PATH ||
    redirectUrl.hash
  ) {
    errors.push("Anonymous document navigation did not reach the canonical Clerk FAPI handshake");
    return errors;
  }

  const redirectValues = redirectUrl.searchParams.getAll("redirect_url");
  if (
    redirectValues.length !== 1 ||
    !validateExactImmutableReturnUrl(redirectValues[0], deploymentUrl, route)
  ) {
    errors.push("Clerk handshake must return to the exact immutable protected route");
  }

  const formatValues = redirectUrl.searchParams.getAll("format");
  if (
    formatValues.length !== 1 ||
    formatValues[0] !== "nonce"
  ) {
    errors.push("Clerk handshake format is not supported by the resolved backend contract");
  }
  if (authStatus && authStatus !== "handshake") {
    errors.push("Clerk handshake auth status is inconsistent");
  }
  if (authReason && !CLERK_HANDSHAKE_REASONS.has(authReason)) {
    errors.push("Clerk handshake auth reason is not recognized by the resolved backend contract");
  }

  return errors;
}

export function classifyClerkAuthRedirect(
  evidence,
  {
    deploymentOrigin,
    frontendApiOrigin,
    accountPortalSignInUrl,
  },
) {
  const errors = [];
  const deploymentUrl = validateDeploymentOrigin(deploymentOrigin);
  if (!deploymentUrl) {
    return {
      classification: null,
      errors: ["Protected-page smoke requires an immutable HTTPS vercel.app origin"],
    };
  }
  if (!PROTECTED_STAGING_ROUTES.includes(evidence?.route)) {
    errors.push("Protected-page smoke route is not allowlisted");
  }
  if (evidence?.status !== EXPECTED_REDIRECT_STATUS) {
    errors.push(
      `Anonymous document navigation must return HTTP ${EXPECTED_REDIRECT_STATUS}`,
    );
  }
  if (typeof evidence?.location !== "string" || !evidence.location) {
    errors.push("Anonymous document navigation must include a Location header");
    return { classification: null, errors };
  }

  const redirectUrl = parseUrl(evidence.location);
  if (!redirectUrl) {
    errors.push("Anonymous document navigation Location must be a valid absolute URL");
    return { classification: null, errors };
  }

  const configuredSignIn = parseUrl(accountPortalSignInUrl);
  let classification = null;
  if (
    configuredSignIn &&
    redirectUrl.origin === configuredSignIn.origin &&
    redirectUrl.pathname === configuredSignIn.pathname
  ) {
    classification = CLERK_AUTH_REDIRECT_CLASSIFICATION.AccountPortalSignIn;
    errors.push(
      ...validateClerkAccountPortalRedirect(redirectUrl, {
        accountPortalSignInUrl,
        deploymentUrl,
        route: evidence.route,
      }),
    );
  } else if (
    redirectUrl.origin === frontendApiOrigin &&
    redirectUrl.pathname === CLERK_HANDSHAKE_PATH
  ) {
    classification = CLERK_AUTH_REDIRECT_CLASSIFICATION.FrontendApiHandshake;
    errors.push(
      ...validateClerkHandshakeRedirect(redirectUrl, {
        frontendApiOrigin,
        deploymentUrl,
        route: evidence.route,
        authStatus: evidence.authStatus,
        authReason: evidence.authReason,
      }),
    );
  } else {
    errors.push("Anonymous document navigation redirect is not a canonical Clerk auth flow");
  }

  return {
    classification: errors.length === 0 ? classification : null,
    errors,
    evidence:
      errors.length === 0
        ? {
            destination:
              classification ===
              CLERK_AUTH_REDIRECT_CLASSIFICATION.FrontendApiHandshake
                ? "canonical-clerk-fapi"
                : "canonical-clerk-account-portal",
            path: redirectUrl.pathname,
            redirectOrigin: "immutable-staging",
            redirectPath: evidence.route,
          }
        : undefined,
  };
}

export function validateProtectedNavigationEvidence(evidence, context) {
  return classifyClerkAuthRedirect(evidence, context).errors;
}

async function fetchClerkEnvironment(frontendApiOrigin, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(new URL("/v1/environment", frontendApiOrigin), {
      method: "GET",
      redirect: "error",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new Error("Clerk Frontend API environment request failed");
  }
  if (!response.ok) {
    throw new Error("Clerk Frontend API environment request did not succeed");
  }
  try {
    return await response.json();
  } catch {
    throw new Error("Clerk Frontend API environment response is not valid JSON");
  }
}

export async function certifyProtectedStagingNavigation({
  deploymentOrigin,
  clerkPublishableKey,
  automationBypassSecret,
  fetchImpl = fetch,
}) {
  if (!automationBypassSecret) {
    throw new Error("Vercel automation bypass secret is required for protected smoke");
  }
  if (!validateDeploymentOrigin(deploymentOrigin)) {
    throw new Error("Protected-page smoke requires an immutable HTTPS vercel.app origin");
  }

  const frontendApiOrigin = deriveClerkFrontendApiOrigin(clerkPublishableKey);
  const clerkEnvironment = await fetchClerkEnvironment(frontendApiOrigin, fetchImpl);
  const { accountPortalSignInUrl } = validateClerkEnvironment(clerkEnvironment, {
    frontendApiOrigin,
    deploymentOrigin,
  });
  console.log("Clerk environment: development instance and configured Account Portal verified.");

  const probes = await Promise.all(
    PROTECTED_STAGING_ROUTES.map(async (route) => {
      try {
        const response = await fetchImpl(new URL(route, deploymentOrigin), {
          method: "GET",
          redirect: "manual",
          headers: {
            ...CLERK_DOCUMENT_REQUEST_HEADERS,
            "x-vercel-protection-bypass": automationBypassSecret,
          },
          signal: AbortSignal.timeout(30_000),
        });
        return {
          route,
          status: response.status,
          location: response.headers.get("location"),
          authReason: response.headers.get("x-clerk-auth-reason"),
          authStatus: response.headers.get("x-clerk-auth-status"),
        };
      } catch {
        return {
          route,
          status: null,
          location: null,
          requestError: true,
        };
      }
    }),
  );

  const failures = [];
  const results = [];
  for (const probe of probes) {
    const result = probe.requestError
      ? {
          classification: null,
          errors: ["Anonymous document navigation request failed"],
        }
      : classifyClerkAuthRedirect(probe, {
          deploymentOrigin,
          frontendApiOrigin,
          accountPortalSignInUrl,
        });
    results.push({
      route: probe.route,
      status: probe.status,
      classification: result.classification,
      evidence: result.evidence,
    });
    if (result.errors.length === 0) {
      console.log(
        `Protected navigation ${probe.route}: HTTP ${probe.status} classification=${result.classification} destination=${result.evidence.destination} path=${result.evidence.path} redirect_origin=${result.evidence.redirectOrigin} redirect_path=${result.evidence.redirectPath}`,
      );
    } else {
      failures.push(...result.errors.map((error) => `${probe.route}: ${error}`));
    }
  }

  if (failures.length > 0) {
    throw new Error(failures.join("\n"));
  }

  return results;
}

const invokedPath = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : undefined;

if (invokedPath === import.meta.url) {
  const [deploymentOrigin, readableEnvironmentPath] = process.argv.slice(2);
  if (!deploymentOrigin || !readableEnvironmentPath) {
    console.error(
      "Usage: node scripts/validate-staging-protected-route-smoke.mjs <immutable-deployment-origin> <readable-environment.json>",
    );
    process.exit(1);
  }

  try {
    const readableEnvironment = JSON.parse(
      fs.readFileSync(readableEnvironmentPath, "utf8"),
    );
    await certifyProtectedStagingNavigation({
      deploymentOrigin,
      clerkPublishableKey:
        readableEnvironment.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
      automationBypassSecret: process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
    });
    console.log(
      "Anonymous browser-document navigation is intercepted by the canonical staging Clerk authentication boundary.",
    );
  } catch (error) {
    console.error(
      `Protected staging navigation certification failed: ${error instanceof Error ? error.message : "unknown error"}`,
    );
    process.exit(1);
  }
}
