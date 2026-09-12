import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { listInternalDemoAgentProfiles } from "@/lib/data/agentProfiles";
import { getMockAgentProfiles } from "@/lib/mock/agentProfiles";
import {
  DEFAULT_AGENT_PROFILE_POLICY,
  parseAgentProfilePolicy,
  resolveAgentProfile,
} from "@/lib/professional";
import { INTERNAL_DEMO_ACCOUNT_ID } from "@/lib/tenancy/internalDemo";

/**
 * The sessionless accessor added by ADR-0052.
 *
 * These tests run with no DATABASE_URL, so they exercise the mock
 * branch. The DB branch — where an operator's stored change actually has
 * to take effect — is covered by the integration suite, which is the
 * only place it can be proved.
 */

const ACCESSOR = path.join(process.cwd(), "lib", "data", "agentProfiles.ts");

describe("listInternalDemoAgentProfiles", () => {
  test("takes no arguments, so no request value can name the tenant", () => {
    // The whole safety argument for skipping withTenantScope rests on
    // this: an accessor with no parameters has no injection surface.
    // A future signature change that accepts an account id would move
    // this page back to trusting caller input on a public route.
    expect(listInternalDemoAgentProfiles.length).toBe(0);

    const source = readFileSync(ACCESSOR, "utf8");
    const signature = source.match(
      /export async function listInternalDemoAgentProfiles\(([^)]*)\)/,
    );
    expect(signature?.[1].trim()).toBe("");
  });

  test("returns only the internal demo tenant's profiles", async () => {
    const result = await listInternalDemoAgentProfiles();
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.length).toBeGreaterThan(0);
    for (const profile of result.data) {
      expect(profile.account_id).toBe(INTERNAL_DEMO_ACCOUNT_ID);
    }
  });

  test("filters by tenant rather than returning the whole fixture array", async () => {
    // The page it replaced called getMockAgentProfiles() unfiltered.
    // Every fixture profile happens to belong to this tenant today, so
    // the filter is invisible until one doesn't — assert the filter
    // exists rather than that the counts happen to match.
    const source = readFileSync(ACCESSOR, "utf8");
    const mockBranch = source.slice(
      source.indexOf("listInternalDemoAgentProfiles"),
      source.indexOf("export async function listAgentProfiles"),
    );
    expect(mockBranch).toContain("INTERNAL_DEMO_ACCOUNT_ID");
    expect(mockBranch).toContain("filter");

    const foreign = getMockAgentProfiles().filter(
      (profile) => profile.account_id !== INTERNAL_DEMO_ACCOUNT_ID,
    );
    const result = await listInternalDemoAgentProfiles();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const profile of foreign) {
      expect(result.data).not.toContainEqual(profile);
    }
  });

  test("a tenant with every profile disabled discloses nothing", () => {
    // Fail-closed: resolveAgentProfile returns null, and the strict
    // default permits no assets and escalates the gated categories.
    // This is what an operator revoking disclosure looks like.
    const allDisabled = getMockAgentProfiles().map((profile) => ({
      ...profile,
      enabled: false,
    }));
    const resolved = resolveAgentProfile(allDisabled);
    expect(resolved).toBeNull();

    const policy = parseAgentProfilePolicy(resolved?.system_policy_json);
    expect(policy.allowedAssetTypes).toEqual([]);
    expect(policy).toEqual(DEFAULT_AGENT_PROFILE_POLICY);
  });

  test("an unreadable policy is never backfilled from the fixtures", () => {
    // The page must treat an error envelope as "unknown", not as
    // "use what is compiled in". Asserted on the page because that is
    // where the decision lives.
    const page = readFileSync(
      path.join(
        process.cwd(),
        "app",
        "(professional)",
        "demo",
        "receptionist",
        "page.tsx",
      ),
      "utf8",
    );
    const modules = [...page.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
    expect(modules).not.toContain("@/lib/mock/agentProfiles");
    expect(modules).toContain("@/lib/data/agentProfiles");
    // null on a failed read, so the strict default governs.
    expect(page).toContain("profiles.ok ? resolveAgentProfile(profiles.data) : null");
  });
});
