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

// Exact public paths.
const PUBLIC_EXACT = new Set<string>([
  "/",
  "/pricing",
  "/api/health",
]);

// Public path prefixes (the prefix itself and anything beneath it).
const PUBLIC_PREFIXES: readonly string[] = [
  // `/demo` and the prospect-facing clickable walkthrough (`/demo/walkthrough/*`).
  "/demo",
  "/sign-in",
  "/sign-up",
  "/industries",
  "/audit",
  "/trust",
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
