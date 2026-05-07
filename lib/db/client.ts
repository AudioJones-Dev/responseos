import "@/lib/serverOnlyGuard";
import { PrismaClient } from "@prisma/client";

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
  var __responseos_prisma__: PrismaClient | null | undefined;
}

function createClient(): PrismaClient | null {
  if (!process.env.DATABASE_URL) {
    return null;
  }
  return new PrismaClient();
}

export const db: PrismaClient | null =
  globalThis.__responseos_prisma__ ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__responseos_prisma__ = db;
}
