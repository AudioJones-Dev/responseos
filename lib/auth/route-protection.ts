/**
 * Public-route classification shared by `proxy.ts` (the Clerk route-protection
 * seam) and its tests. A path is public when it is the marketing/landing
 * surface, a Clerk-managed auth page, the health probe, or a webhook endpoint
 * (webhooks self-validate per ADR-0009). Everything else is protected: when
 * Clerk is active, the proxy enforces sign-in.
 *
 * Kept dependency-free so it can be unit-tested without constructing
 * `NextRequest` objects, and reused verbatim by the proxy.
 */

// Exact public paths. `/audit` and `/trust` are prospect-facing marketing
// pages linked from the marketing nav alongside `/`, `/demo`, and `/pricing`;
// `/audit` is the lead-capture form, so gating it behind sign-in would break
// the top of the funnel. `/privacy` and `/terms` must be readable before anyone submits it.
const PUBLIC_EXACT = new Set<string>([
  "/",
  "/pricing",
  "/audit",
  "/trust",
  "/privacy",
  "/terms",
  "/stories/florida-ramp-and-lift",
  "/api/health",
]);

// Public path prefixes (the prefix itself and anything beneath it).
const PUBLIC_PREFIXES: readonly string[] = [
  // `/demo` and the prospect-facing clickable walkthrough (`/demo/walkthrough/*`).
  "/demo",
  "/sign-in",
  "/sign-up",
  "/industries",
  "/api/webhooks",
];

// ADR-0047 §6 keeps public intake off until the WAF gate is proven. The API,
// this route guard and the `/audit` page must agree, or the page offers a form
// whose submissions are redirected to sign-in and lost.
export function isPublicAuditIntakeEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return env.RESPONSEOS_PUBLIC_AUDIT_INTAKE_ENABLED === "true";
}

export function isPublicPath(
  pathname: string,
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  if (pathname === "/api/audit-requests" && isPublicAuditIntakeEnabled(env)) {
    return true;
  }
  if (PUBLIC_EXACT.has(pathname)) {
    return true;
  }
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
