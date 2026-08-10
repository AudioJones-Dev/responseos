import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  process.env = { ...ORIGINAL_ENV };
  const env = process.env as Record<string, string | undefined>;
  delete env.DATABASE_URL;
  delete env.RESPONSEOS_DEV_SESSION;
  delete env.NODE_ENV;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("internal reference tenant foundation", () => {
  test("admin can read Tyrone's four scoped agent profiles and demo opportunity", async () => {
    const { AgentProfiles, Opportunities } = await import("@/lib/data");

    const profiles = await AgentProfiles.listAgentProfiles({
      accountId: "acct_internal_demo_tyrone",
    });
    const opportunities = await Opportunities.listOpportunities({
      accountId: "acct_internal_demo_tyrone",
    });

    expect(profiles.ok).toBe(true);
    expect(opportunities.ok).toBe(true);
    if (!profiles.ok || !opportunities.ok) return;
    expect(profiles.data.map((profile) => profile.profile_type)).toEqual([
      "recruiter_receptionist",
      "consulting_receptionist",
      "professional_assistant",
      "demo_mode",
    ]);
    expect(profiles.data.filter((profile) => profile.is_default)).toHaveLength(1);
    expect(opportunities.data).toHaveLength(1);
    expect(opportunities.data[0].details_json).toMatchObject({
      fixture: true,
      company: "Censys",
      roleTitle: "Business Systems Analyst",
    });
  });

  test("a customer tenant cannot read the internal reference tenant", async () => {
    process.env.RESPONSEOS_DEV_SESSION = "client_admin@org_mock_1";
    vi.resetModules();
    const { AgentProfiles, Opportunities } = await import("@/lib/data");

    const profiles = await AgentProfiles.listAgentProfiles({
      accountId: "acct_internal_demo_tyrone",
    });
    const opportunities = await Opportunities.listOpportunities({
      accountId: "acct_internal_demo_tyrone",
    });

    expect(profiles.ok).toBe(false);
    expect(opportunities.ok).toBe(false);
    if (profiles.ok || opportunities.ok) return;
    expect(profiles.error.code).toBe("tenant_scope_denied");
    expect(opportunities.error.code).toBe("tenant_scope_denied");
  });
});
