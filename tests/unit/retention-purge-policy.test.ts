import { describe, expect, test } from "vitest";
import {
  assertRetentionPurgeAllowed,
  parseRetentionPurgeArgs,
} from "@/lib/retention/purgePolicy";

const DATABASE_URL = "postgresql://localhost:5432/responseos_test";

describe("parseRetentionPurgeArgs", () => {
  test("previews by default and applies only with --apply", () => {
    expect(parseRetentionPurgeArgs([])).toBe("preview");
    expect(parseRetentionPurgeArgs(["--apply"])).toBe("apply");
  });

  test("rejects anything else rather than silently previewing", () => {
    expect(() => parseRetentionPurgeArgs(["--aply"])).toThrow('Unknown argument "--aply"');
    expect(() => parseRetentionPurgeArgs(["--apply", "--force"])).toThrow('Unknown argument "--force"');
  });
});

describe("assertRetentionPurgeAllowed", () => {
  test("requires a database in either mode", () => {
    expect(() => assertRetentionPurgeAllowed("preview", {})).toThrow("DATABASE_URL");
    expect(() =>
      assertRetentionPurgeAllowed("apply", { RESPONSEOS_RETENTION_PURGE_ENABLED: "true" }),
    ).toThrow("DATABASE_URL");
  });

  test("allows preview without the enable flag, even in production", () => {
    expect(assertRetentionPurgeAllowed("preview", { DATABASE_URL })).toEqual({});
    expect(() =>
      assertRetentionPurgeAllowed("preview", { DATABASE_URL, NODE_ENV: "production", VERCEL_ENV: "production" }),
    ).not.toThrow();
  });

  test("requires the exact enable flag to apply", () => {
    for (const value of [undefined, "", "1", "TRUE", "yes"]) {
      expect(() =>
        assertRetentionPurgeAllowed("apply", { DATABASE_URL, RESPONSEOS_RETENTION_PURGE_ENABLED: value }),
      ).toThrow("RESPONSEOS_RETENTION_PURGE_ENABLED=true");
    }
  });

  test("refuses to apply in production", () => {
    const enabled = { DATABASE_URL, RESPONSEOS_RETENTION_PURGE_ENABLED: "true" };
    expect(() => assertRetentionPurgeAllowed("apply", { ...enabled, NODE_ENV: "production" })).toThrow(
      "disabled in production",
    );
    expect(() => assertRetentionPurgeAllowed("apply", { ...enabled, VERCEL_ENV: "production" })).toThrow(
      "disabled in production",
    );
  });

  test("returns the server-owned account scopes, treating empty values as unset", () => {
    expect(
      assertRetentionPurgeAllowed("apply", {
        DATABASE_URL,
        RESPONSEOS_RETENTION_PURGE_ENABLED: "true",
        VERCEL_ENV: "preview",
        RESPONSEOS_INBOUND_ACCOUNT_ID: "inbound-account",
        RESPONSEOS_DEMO_ACCOUNT_ID: "",
      }),
    ).toEqual({ inboundAccountId: "inbound-account", demoAccountId: undefined });
  });
});
