import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { listInternalDemoAgentProfiles } from "@/lib/data/agentProfiles";
import {
  listShareableAssets,
  parseAgentProfilePolicy,
  resolveAgentProfile,
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

/** What the page would share, resolved the way the page resolves it. */
async function shareableAssetTypes(): Promise<string[]> {
  const profiles = await listInternalDemoAgentProfiles();
  expect(profiles.ok).toBe(true);
  if (!profiles.ok) return [];

  const policy = parseAgentProfilePolicy(
    resolveAgentProfile(profiles.data)?.system_policy_json,
  );
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

  test("disabling every profile discloses nothing at all", async () => {
    expect(await shareableAssetTypes()).not.toEqual([]);

    await prisma.agentProfile.updateMany({
      where: { account_id: INTERNAL_DEMO_ACCOUNT_ID },
      data: { enabled: false },
    });

    // resolveAgentProfile returns null, so the strict default governs.
    expect(await shareableAssetTypes()).toEqual([]);
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
