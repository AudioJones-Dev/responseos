import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { listInternalDemoAgentProfiles } from "@/lib/data/agentProfiles";
import {
  answerProfessionalQuestion,
  DEFAULT_AGENT_PROFILE_POLICY,
  listShareableAssets,
  parseAgentProfilePolicy,
  resolveAgentProfile,
  type AgentProfilePolicy,
} from "@/lib/professional";
import { INTERNAL_DEMO_ACCOUNT_ID } from "@/lib/tenancy/internalDemo";
import { disconnectTestDb, prisma, resetAndSeedTestDb } from "./setup";

/**
 * ADR-0052 — the public demo surface honours the tenant's *stored*
 * disclosure policy.
 *
 * Only a real database can prove this. With no DATABASE_URL the
 * accessor reads fixtures, and fixtures are exactly what the previous
 * implementation read; the bug was invisible until a stored row said
 * something different from what was compiled in. So every test here
 * changes a row and asserts the page's disclosure follows.
 */

const DEFAULT_PROFILE = "agent_tyrone_recruiter";

/**
 * The policy governing the page, resolved the way the page resolves it.
 * `null` is the page's off switch: with no governing profile it answers
 * nothing rather than falling back to the strict default.
 */
async function governingPolicy(): Promise<AgentProfilePolicy | null> {
  const profiles = await listInternalDemoAgentProfiles();
  if (!profiles.ok) return null;
  const agentProfile = resolveAgentProfile(profiles.data);
  return agentProfile
    ? parseAgentProfilePolicy(agentProfile.system_policy_json)
    : null;
}

/** What the page would share. Empty when it is not answering at all. */
async function shareableAssetTypes(): Promise<string[]> {
  const policy = await governingPolicy();
  if (!policy) return [];

  const assets = await listShareableAssets({
    accountId: INTERNAL_DEMO_ACCOUNT_ID,
    policy,
  });
  return assets.map((asset) => asset.type).sort();
}

beforeEach(async () => {
  await resetAndSeedTestDb();
  // Deliberately no setDevSession: this accessor has to work for an
  // anonymous visitor, which is the whole reason it exists.
  delete process.env.RESPONSEOS_DEV_SESSION;
});

afterAll(async () => {
  await disconnectTestDb();
});

describe("public demo surface honours the stored disclosure policy", () => {
  test("reads without a session", async () => {
    const result = await listInternalDemoAgentProfiles();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.length).toBeGreaterThan(0);
    expect(
      result.data.every(
        (profile) => profile.account_id === INTERNAL_DEMO_ACCOUNT_ID,
      ),
    ).toBe(true);
  });

  test("revoking one asset type in the database stops it being shared", async () => {
    const before = await shareableAssetTypes();
    expect(before).toContain("email");

    // Exactly the operator action #164 described: drop an asset type
    // from the stored policy, deploy nothing.
    const profile = await prisma.agentProfile.findUniqueOrThrow({
      where: { id: DEFAULT_PROFILE },
    });
    const policy = profile.system_policy_json as Record<string, unknown>;
    await prisma.agentProfile.update({
      where: { id: DEFAULT_PROFILE },
      data: {
        system_policy_json: {
          ...policy,
          allowedAssetTypes: (policy.allowedAssetTypes as string[]).filter(
            (type) => type !== "email",
          ),
        },
      },
    });

    const after = await shareableAssetTypes();
    expect(after).not.toContain("email");
    // Only the revoked one goes — this is a policy change, not an outage.
    expect(after).toEqual(before.filter((type) => type !== "email"));
  });

  test("disabling every profile stops answers, not just assets", async () => {
    expect(await shareableAssetTypes()).not.toEqual([]);
    expect(await governingPolicy()).not.toBeNull();

    await prisma.agentProfile.updateMany({
      where: { account_id: INTERNAL_DEMO_ACCOUNT_ID },
      data: { enabled: false },
    });

    // The earlier version of this test asserted only the asset list and
    // was named as though it proved more. It didn't: the strict default
    // withholds assets and escalates the gated categories, but
    // `applyPolicy` consults the policy for those categories *only*, so
    // work history, projects, skills and certifications kept `answer`
    // authority and the page went on reciting verified records after the
    // operator switched the agent off. The page now has no policy to
    // answer under at all, which is what the assertion below pins.
    expect(await governingPolicy()).toBeNull();
    expect(await shareableAssetTypes()).toEqual([]);

    // Proof that the strict default alone would not have been enough.
    for (const question of [
      "What is his business systems experience?",
      "What projects has he built?",
      "Which certifications does he hold?",
    ]) {
      const wouldAnswer = await answerProfessionalQuestion({
        accountId: INTERNAL_DEMO_ACCOUNT_ID,
        question,
        policy: DEFAULT_AGENT_PROFILE_POLICY,
      });
      expect(wouldAnswer.answered, question).toBe(true);
    }
  });

  test("another tenant's default profile cannot govern this page", async () => {
    const before = await shareableAssetTypes();

    // A foreign tenant with a more permissive default. If the accessor
    // ever stopped filtering by account, this row would win — it is
    // enabled, default, and sorts ahead of the demo tenant's by slug.
    await prisma.agentProfile.create({
      data: {
        id: "agent_foreign_default",
        account_id: "org_mock_1",
        name: "Foreign Default",
        slug: "aaa-foreign-default",
        type: "recruiter_receptionist",
        enabled: true,
        is_default: true,
        system_policy_json: {
          allowedAppointmentTypes: ["recruiter_screen"],
          allowedAssetTypes: ["resume", "portfolio", "linkedin", "github", "email"],
          compensationDisclosure: "answer",
          referencesDisclosure: "answer",
          knowledgeFallback: "verified_only",
        },
      },
    });

    const result = await listInternalDemoAgentProfiles();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.map((profile) => profile.id)).not.toContain(
      "agent_foreign_default",
    );
    expect(await shareableAssetTypes()).toEqual(before);

    // And the foreign profile's permissive disclosure never leaks in.
    const policy = parseAgentProfilePolicy(
      resolveAgentProfile(result.data)?.system_policy_json,
    );
    expect(policy.compensationDisclosure).toBe("escalate");
    expect(policy.referencesDisclosure).toBe("escalate");
  });
});
