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

const EXPECTED_REDIRECT_STATUS = 307;
const IMMUTABLE_VERCEL_HOST =
  /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.vercel\.app$/;

function decodeClerkTestPublishableKey(publishableKey) {
  if (
    typeof publishableKey !== "string" ||
    !/^pk_test_[A-Za-z0-9+/]+$/.test(publishableKey)
  ) {
    throw new Error("Staging Clerk publishable key must be a valid test-mode key");
  }

  let decoded;
  try {
    decoded = Buffer.from(publishableKey.slice("pk_test_".length), "base64").toString(
      "utf8",
    );
  } catch {
    throw new Error("Staging Clerk publishable key cannot be decoded");
  }

  if (!decoded.endsWith("$")) {
    throw new Error("Staging Clerk publishable key has invalid frontend API evidence");
  }

  const frontendApi = decoded.slice(0, -1);
  let frontendUrl;
  try {
    frontendUrl = new URL(`https://${frontendApi}`);
  } catch {
    throw new Error("Staging Clerk publishable key has invalid frontend API evidence");
  }
  if (
    frontendUrl.hostname !== frontendApi ||
    frontendUrl.port ||
    !frontendApi.endsWith(".clerk.accounts.dev")
  ) {
    throw new Error("Staging Clerk frontend API is not a development instance");
  }

  return frontendApi;
}

export function deriveClerkTestAccountsOrigin(publishableKey) {
  const frontendApi = decodeClerkTestPublishableKey(publishableKey);
  const accountsHost = frontendApi
    .replace(/clerk\.accountsstage\./, "accountsstage.")
    .replace(/clerk\.accounts\.|clerk\./, "accounts.");
  const accountsUrl = new URL(`https://${accountsHost}`);

  if (
    accountsUrl.protocol !== "https:" ||
    accountsUrl.hostname !== accountsHost ||
    !accountsHost.endsWith(".accounts.dev")
  ) {
    throw new Error("Staging Clerk Account Portal is not a development instance");
  }

  return accountsUrl.origin;
}

function validateDeploymentOrigin(value) {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      !IMMUTABLE_VERCEL_HOST.test(url.hostname) ||
      url.hostname === CANONICAL_STAGING_VERCEL.managedEnvironmentAlias ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

export function validateProtectedNavigationEvidence(
  evidence,
  { deploymentOrigin, clerkPublishableKey },
) {
  const errors = [];
  const deploymentUrl = validateDeploymentOrigin(deploymentOrigin);
  if (!deploymentUrl) {
    return ["Protected-page smoke requires an immutable HTTPS vercel.app origin"];
  }

  let expectedAccountsOrigin;
  try {
    expectedAccountsOrigin = deriveClerkTestAccountsOrigin(clerkPublishableKey);
  } catch (error) {
    return [error instanceof Error ? error.message : "Invalid Clerk publishable key evidence"];
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
    return errors;
  }

  let redirectUrl;
  try {
    redirectUrl = new URL(evidence.location, deploymentUrl);
  } catch {
    errors.push("Anonymous document navigation Location must be a valid URL");
    return errors;
  }

  if (
    redirectUrl.protocol !== "https:" ||
    redirectUrl.origin !== expectedAccountsOrigin ||
    redirectUrl.username ||
    redirectUrl.password ||
    redirectUrl.port ||
    redirectUrl.hash ||
    !/^\/sign-in\/?$/.test(redirectUrl.pathname)
  ) {
    errors.push("Anonymous document navigation must redirect to the staging Clerk sign-in page");
  }
  if (
    redirectUrl.origin === deploymentUrl.origin ||
    redirectUrl.pathname === evidence.route
  ) {
    errors.push("Anonymous document navigation must not redirect back to the protected route");
  }

  const returnBack = redirectUrl.searchParams.get("redirect_url");
  if (returnBack) {
    try {
      const returnBackUrl = new URL(returnBack);
      if (
        returnBackUrl.protocol !== "https:" ||
        returnBackUrl.origin !== deploymentUrl.origin ||
        returnBackUrl.pathname !== evidence.route
      ) {
        errors.push("Clerk sign-in return path must preserve the immutable protected route");
      }
    } catch {
      errors.push("Clerk sign-in return path must be a valid immutable URL");
    }
  }

  return errors;
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
  for (const probe of probes) {
    const errors = probe.requestError
      ? ["Anonymous document navigation request failed"]
      : validateProtectedNavigationEvidence(probe, {
          deploymentOrigin,
          clerkPublishableKey,
        });
    if (errors.length === 0) {
      console.log(
        `Protected navigation ${probe.route}: HTTP ${probe.status} -> Clerk test sign-in`,
      );
    } else {
      failures.push(...errors.map((error) => `${probe.route}: ${error}`));
    }
  }

  if (failures.length > 0) {
    throw new Error(failures.join("\n"));
  }

  return probes;
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
      "Anonymous browser-document navigation is protected by the staging Clerk sign-in boundary.",
    );
  } catch (error) {
    console.error(
      `Protected staging navigation certification failed: ${error instanceof Error ? error.message : "unknown error"}`,
    );
    process.exit(1);
  }
}
