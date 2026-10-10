import "@/lib/serverOnlyGuard";
import { createRecoveringClient, type RecoveringClient } from "./recoveringClient";

/**
 * Prisma singleton with graceful no-DB fallback.
 *
 * - When `DATABASE_URL` is set, exports a singleton PrismaClient.
 * - When `DATABASE_URL` is missing, exports `null`. Every `lib/data/*`
 *   accessor must check for this and fall back to `lib/mock/*`.
 *
 * The singleton is hoisted onto `globalThis` in non-production environments
 * to survive Next.js dev-server hot reloads without leaking connections.
 */

declare global {
  var __responseos_prisma__: RecoveringClient | null | undefined;
}

function createClient(): RecoveringClient | null {
  if (!process.env.DATABASE_URL) {
    return null;
  }
  return createRecoveringClient();
}

export const db: RecoveringClient | null =
  globalThis.__responseos_prisma__ ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__responseos_prisma__ = db;
}
