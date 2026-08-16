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
// the top of the funnel.
const PUBLIC_EXACT = new Set<string>([
  "/",
  "/pricing",
  "/audit",
  "/trust",
  "/api/health",
  // Lead-capture POST must stay reachable when RESPONSEOS_REQUIRE_AUTH is on
  // (BUILD_STATUS §3e / ADR-0039 / ADR-0046).
  "/api/audit-requests",
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

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) {
    return true;
  }
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
