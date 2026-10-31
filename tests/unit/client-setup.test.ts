import { describe, expect, test } from "vitest";
import { buildSetupDraft, CreateSetupSchema, DISABLED_CAPABILITIES, localSetupWritesAllowed, normalizedBusinessName, phoneDigitForms, SetupDraftSchema, UpdateSetupSchema } from "@/lib/clientSetup/contracts";
import { SYNTHETIC_SETUP_INPUT } from "@/lib/clientSetup/fixture";
import { setupResponse } from "@/lib/clientSetup/http";

describe("inactive client setup boundaries", () => {
  test.each(["businessName", "slug", "industry", "timezone", "founderName", "contactNumber"])("requires %s", (field) => {
    expect(CreateSetupSchema.safeParse({ ...SYNTHETIC_SETUP_INPUT, [field]: "" }).success).toBe(false);
  });
  test.each([{ timezone: "Moon/Base" }, { contactNumber: "2025550123" }, { founderName: "   " }, { slug: "Wrong Slug" }])("rejects invalid values %j", (changes) => {
    expect(CreateSetupSchema.safeParse({ ...SYNTHETIC_SETUP_INPUT, ...changes }).success).toBe(false);
  });
  test.each(["status", "accountId", "clerk_org_id", "ownerEmail", "capabilities", "approved_at", "providerNumberId"])("rejects injected %s", (field) => {
    expect(CreateSetupSchema.safeParse({ ...SYNTHETIC_SETUP_INPUT, [field]: "active" }).success).toBe(false);
  });
  test("all capabilities are fixed off and no approval fields are accepted", () => {
    const draft = buildSetupDraft(SYNTHETIC_SETUP_INPUT, 1);
    expect(Object.values(draft.capabilities)).toEqual(Array(7).fill(false));
    expect(draft.capabilities).toEqual(DISABLED_CAPABILITIES);
    expect(draft).toMatchObject({ status: "draft", provisioned: false, consentApproval: "pending", receptionistPublication: "not_published" });
    expect(SetupDraftSchema.safeParse({ ...draft, status: "approved" }).success).toBe(false);
    for (const capability of Object.keys(DISABLED_CAPABILITIES)) expect(SetupDraftSchema.safeParse({ ...draft, capabilities: { ...draft.capabilities, [capability]: true } }).success).toBe(false);
    expect(UpdateSetupSchema.safeParse({ revision: 1, draft: { ...SYNTHETIC_SETUP_INPUT, status: "approved" } }).success).toBe(false);
  });
  test("number comparison covers digits-only and NANP national forms", () => {
    expect(phoneDigitForms("+12025550142")).toEqual(["12025550142", "2025550142"]);
    expect(phoneDigitForms("+442071838750")).toEqual(["442071838750"]);
    for (const stored of ["+1 (202) 555-0142", "202-555-0142", "12025550142", "(202) 555 0142"]) {
      expect(phoneDigitForms("+12025550142")).toContain(stored.replace(/\D/g, ""));
    }
    expect(phoneDigitForms("+12025550142")).not.toContain("5550142");
  });
  test("duplicate business normalization covers case, punctuation and ampersands", () => {
    expect(normalizedBusinessName(" Example Ramp & Lift ")).toBe(normalizedBusinessName("EXAMPLE RAMP AND LIFT"));
  });
  test("writes fail closed for production, hosted previews, missing flag and remote databases", () => {
    const env = { NODE_ENV: "development", RESPONSEOS_LOCAL_CLIENT_SETUP: "1", DATABASE_URL: "postgresql://localhost/responseos_inactive_setup_test" };
    expect(localSetupWritesAllowed(env)).toBe(true);
    for (const changes of [{ NODE_ENV: "production" }, { VERCEL_ENV: "preview" }, { VERCEL: "1" }, { RESPONSEOS_LOCAL_CLIENT_SETUP: "0" }, { DATABASE_URL: "postgresql://example.neon.tech/neondb" }, { DATABASE_URL: "postgresql://localhost/another_database" }, { DATABASE_URL: "invalid" }]) {
      expect(localSetupWritesAllowed({ ...env, ...changes })).toBe(false);
    }
  });
  test("conflicts and blocked writes have actionable HTTP codes", () => {
    expect(setupResponse({ ok: false, error: { code: "duplicate_account", message: "duplicate" } }).status).toBe(409);
    expect(setupResponse({ ok: false, error: { code: "setup_write_blocked", message: "blocked" } }).status).toBe(403);
  });
  test("local database guard refuses connection-option overrides", () => {
    for (const suffix of ["?host=example.invalid", "?schema=other", "#ignored"]) {
      expect(localSetupWritesAllowed({ NODE_ENV: "test", RESPONSEOS_LOCAL_CLIENT_SETUP: "1", DATABASE_URL: `postgresql://localhost/responseos_inactive_setup_test${suffix}` })).toBe(false);
    }
  });
});
