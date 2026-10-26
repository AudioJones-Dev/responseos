import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { isConnectionLoss } from "../../lib/db/recoveringClient";

const known = (code: string, meta?: Record<string, unknown>) =>
  new Prisma.PrismaClientKnownRequestError("synthetic", { code, clientVersion: "6.19.3", meta });
const uncoded = (message: string) => new Prisma.PrismaClientUnknownRequestError(message, { clientVersion: "6.19.3" });
// The form Prisma 6.19.3 raised against PostgreSQL 16 for `client.account.create()`
// and `findUnique()` issued right after pg_terminate_backend.
const engineDebug = (operation: string, sqlState: string, message: string, severity: string) =>
  `\nInvalid \`client.account.${operation}()\` invocation in\n/synthetic/test.ts:1:1\n\nError occurred during query execution:\nConnectorError(ConnectorError { user_facing_error: None, kind: QueryError(PostgresError { code: "${sqlState}", message: "${message}", severity: "${severity}", detail: None, column: None, hint: None }), transient: false })`;

describe("connection loss detection", () => {
  it("treats a closed connection as connection loss", () => expect(isConnectionLoss(known("P1017"))).toBe(true));
  it.each(["57P01", "57P02", "08006"])("treats a raw query failed with SQLSTATE %s as connection loss", (sqlState) =>
    expect(isConnectionLoss(known("P2010", { code: sqlState, message: "terminating connection due to administrator command" }))).toBe(true));
  it.each([
    "FATAL: terminating connection due to administrator command",
    "WARNING: terminating connection because of crash of another server process",
    "WARNING: terminating connection due to immediate shutdown command",
    "WARNING: terminating connection because of unexpected SIGQUIT signal",
  ])("treats an uncoded batch failure reporting '%s' as connection loss", (message) =>
    expect(isConnectionLoss(uncoded(`Error in connector: Error querying the database: ${message}`))).toBe(true));
  it.each([
    ["create", "57P01", "terminating connection due to administrator command", "FATAL"],
    ["findUnique", "57P01", "terminating connection due to administrator command", "FATAL"],
    ["findUnique", "57P02", "terminating connection because of crash of another server process", "WARNING"],
  ])("treats an uncoded %s failure carrying SQLSTATE %s in the driver's debug form as connection loss", (operation, sqlState, message, severity) =>
    expect(isConnectionLoss(uncoded(engineDebug(operation, sqlState, message, severity)))).toBe(true));
  it.each([
    ["a unique violation", known("P2002")],
    ["a statement timeout in the driver's debug form", uncoded(engineDebug("findUnique", "57014", "canceling statement due to statement timeout", "ERROR"))],
    ["a background worker's shutdown in the driver's debug form", uncoded(engineDebug("findUnique", "57P01", "terminating autovacuum process due to administrator command", "FATAL"))],
    ["a session-ending message at the wrong severity in the driver's debug form", uncoded(engineDebug("create", "57P01", "terminating connection due to administrator command", "ERROR"))],
    ["a raw query syntax error", known("P2010", { code: "42601" })],
    ["a raw query failure without a SQLSTATE", known("P2010")],
    ["a plain error", new Error("P1017")],
    ["a non-error value", { code: "P1017" }],
    ["an uncoded failure that is not a shutdown", uncoded("Error in connector: Error querying the database: ERROR: canceling statement due to statement timeout")],
    ["an uncoded failure that only names a background worker's shutdown", uncoded("Error in connector: Error querying the database: FATAL: terminating autovacuum process due to administrator command")],
  ])("ignores %s", (_label, error) => expect(isConnectionLoss(error)).toBe(false));
});
