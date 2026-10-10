import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { isConnectionLoss } from "../../lib/db/recoveringClient";

const known = (code: string, meta?: Record<string, unknown>) =>
  new Prisma.PrismaClientKnownRequestError("synthetic", { code, clientVersion: "6.19.3", meta });

describe("connection loss detection", () => {
  it("treats a closed connection as connection loss", () => expect(isConnectionLoss(known("P1017"))).toBe(true));
  it.each(["57P01", "57P02", "08006"])("treats a raw query failed with SQLSTATE %s as connection loss", (sqlState) =>
    expect(isConnectionLoss(known("P2010", { code: sqlState, message: "terminating connection due to administrator command" }))).toBe(true));
  it.each([
    ["a unique violation", known("P2002")],
    ["a raw query syntax error", known("P2010", { code: "42601" })],
    ["a raw query failure without a SQLSTATE", known("P2010")],
    ["a plain error", new Error("P1017")],
    ["a non-error value", { code: "P1017" }],
  ])("ignores %s", (_label, error) => expect(isConnectionLoss(error)).toBe(false));
});
