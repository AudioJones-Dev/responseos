import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { listInternalDemoAgentProfiles } from "@/lib/data/agentProfiles";
import { getMockAgentProfiles } from "@/lib/mock/agentProfiles";
import {
  answerProfessionalQuestion,
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
const PAGE = path.join(
  process.cwd(),
  "app",
  "(professional)",
  "demo",
  "receptionist",
  "page.tsx",
);

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

  test("the strict default is not by itself a revocation", async () => {
    // Worth pinning because it is the trap this page fell into. With
    // every profile disabled, resolveAgentProfile returns null — but
    // parsing that null yields the strict default, and the strict
    // default still ANSWERS. `applyPolicy` consults the policy for
    // compensation, references and consulting rates only; every other
    // category keeps its base authority.
    const allDisabled = getMockAgentProfiles().map((profile) => ({
      ...profile,
      enabled: false,
    }));
    expect(resolveAgentProfile(allDisabled)).toBeNull();
    expect(parseAgentProfilePolicy(undefined)).toEqual(
      DEFAULT_AGENT_PROFILE_POLICY,
    );

    const answered = await answerProfessionalQuestion({
      accountId: INTERNAL_DEMO_ACCOUNT_ID,
      question: "What projects has he built?",
      policy: DEFAULT_AGENT_PROFILE_POLICY,
    });
    expect(answered.answered).toBe(true);
    expect(answered.sources.length).toBeGreaterThan(0);

    // So the page must not reach the answering path at all when there is
    // no governing profile — it holds a nullable policy and short-circuits.
    const page = readFileSync(PAGE, "utf8");
    expect(page).toContain("policy && question");
    expect(page).toContain("if (!policy)");
  });

  test("an unreadable policy is never backfilled from the fixtures", () => {
    // The page must treat an error envelope as "unknown", not as
    // "use what is compiled in". Asserted on the page because that is
    // where the decision lives.
    const page = readFileSync(PAGE, "utf8");
    const modules = [...page.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
    expect(modules).not.toContain("@/lib/mock/agentProfiles");
    expect(modules).toContain("@/lib/data/agentProfiles");
    // null on a failed read, which leaves no governing policy — and the
    // page answers nothing rather than falling back to any default.
    expect(page).toContain("profiles.ok ? resolveAgentProfile(profiles.data) : null");
  });
});
