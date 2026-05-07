import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

describe("lib/db/client.ts", () => {
  beforeEach(() => {
    vi.resetModules();
    delete (globalThis as { __responseos_prisma__?: unknown })
      .__responseos_prisma__;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  test("returns null when DATABASE_URL is unset", async () => {
    delete process.env.DATABASE_URL;
    const mod = await import("@/lib/db/client");
    expect(mod.db).toBeNull();
  });

  test("returns a PrismaClient when DATABASE_URL is set", async () => {
    process.env.DATABASE_URL =
      "postgresql://placeholder:placeholder@localhost:5432/placeholder";
    const mod = await import("@/lib/db/client");
    expect(mod.db).not.toBeNull();
    // PrismaClient instance has a $disconnect method.
    expect(typeof (mod.db as { $disconnect: unknown }).$disconnect).toBe(
      "function",
    );
    await (mod.db as { $disconnect: () => Promise<void> }).$disconnect();
  });
});
