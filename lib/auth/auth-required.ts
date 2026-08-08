/**
 * Auth-required deploy signal, shared by the edge proxy (`proxy.ts`) and the
 * session resolver (`lib/auth/session.ts`).
 *
 * Kept dependency-free on purpose: `proxy.ts` runs in the edge runtime and must
 * not import `lib/auth/session.ts`, which pulls in the server-only guard, the
 * Prisma client, and the Clerk server SDK.
 *
 * When `RESPONSEOS_REQUIRE_AUTH` is set, a deploy with no Clerk configuration
 * fails closed rather than falling back to the privileged `aj_admin`
 * placeholder session. When unset, mock-first boot is preserved unchanged for
 * local dev, CI, `next build`, and the mock-safe hosted demo (ADR-0001) — the
 * demo is itself a production build and must still render its mock data.
 */
export function isAuthRequired(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  const value = env.RESPONSEOS_REQUIRE_AUTH;
  return Boolean(value && value !== "0" && value.toLowerCase() !== "false");
}
