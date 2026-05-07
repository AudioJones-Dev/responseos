/**
 * Server-only runtime guard. Importing this module from a client bundle
 * throws at module evaluation time. Used as a substitute for the
 * `server-only` package without adding a runtime dependency.
 *
 * Place `import "@/lib/serverOnlyGuard";` at the top of every server-only
 * module (Prisma client, session resolver, data accessors).
 */
if (typeof window !== "undefined") {
  throw new Error(
    "Server-only module imported from a client bundle. Move the caller to a server component, server action, or route handler.",
  );
}
export {};
