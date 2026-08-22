import { afterAll, beforeEach, describe, expect, test } from "vitest";
import {
  buildClientEnvironmentManifest,
  compileDiscoverySnapshot,
  createDiscoveryFinding,
  promoteProspectToDiscovery,
  reviewDiscoveryFinding,
} from "@/lib/clientEnvironment/service";
import {
  createAndApproveMemorySnapshot,
  createProspectBootstrap,
  getProspectBootstrapDetail,
  ingestProspectBootstrap,
  reviewKnowledgeFact,
} from "@/lib/prospectBootstrap/service";
import { disconnectTestDb, prisma, resetAndSeedTestDb, setDevSession } from "./setup";

const startedAt = new Date("2026-08-22T17:00:00.000Z");
const publicLookup = async () => [{ address: "93.184.216.34", family: 4 }];

function unwrap<T>(result: { ok: true; data: T } | { ok: false; error: { code: string; message: string } }): T {
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.data;
}

const websiteFetch: typeof fetch = async (input) => {
  const url = new URL(input instanceof Request ? input.url : input.toString());
  if (url.pathname === "/robots.txt") {
    return new Response("User-agent: *\nDisallow:", { status: 200, headers: { "content-type": "text/plain" } });
  }
  return new Response("Evergreen Roofing. Call 305-555-0144 for roof repair.", {
    status: 200,
    headers: { "content-type": "text/plain" },
  });
};

async function prepareCompletedBootstrap() {
  const created = unwrap(await createProspectBootstrap({
    businessName: "Evergreen Roofing",
    canonicalWebsite: "https://evergreen.example/",
  }));
  unwrap(await ingestProspectBootstrap({
    bootstrapId: created.bootstrap.id,
    fetchFn: websiteFetch,
    lookupFn: publicLookup,
    now: startedAt,
  }));
  const detail = unwrap(await getProspectBootstrapDetail(created.bootstrap.id));
  for (const fact of detail.facts) {
    if (fact.status === "source_observed" || fact.status === "cross_source_confirmed") {
      unwrap(await reviewKnowledgeFact({ factId: fact.id, status: "operator_approved_for_demo" }));
    }
  }
  unwrap(await createAndApproveMemorySnapshot({
    bootstrapId: created.bootstrap.id,
    reviewAcknowledged: true,
  }));
  await prisma.prospectBootstrap.update({
    where: { id: created.bootstrap.id },
    data: { status: "completed", completed_at: startedAt },
  });
  return created;
}

describe("client environment promotion and progressive discovery", () => {
  beforeEach(async () => {
    await resetAndSeedTestDb();
    setDevSession("aj_admin");
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  test("preserves tenant identity and enriches the same account through discovery", async () => {
    const created = await prepareCompletedBootstrap();
    const before = unwrap(await getProspectBootstrapDetail(created.bootstrap.id));
    const websiteSource = before.sources[0];
    expect(websiteSource.expires_at).toBeInstanceOf(Date);

    const unacknowledged = await promoteProspectToDiscovery({
      bootstrapId: created.bootstrap.id,
      promotionAcknowledged: false,
    }, startedAt);
    expect(unacknowledged.ok).toBe(false);
    if (!unacknowledged.ok) expect(unacknowledged.error.code).toBe("promotion_acknowledgment_required");

    const promoted = unwrap(await promoteProspectToDiscovery({
      bootstrapId: created.bootstrap.id,
      promotionAcknowledged: true,
    }, startedAt));
    expect(promoted.replay).toBe(false);
    expect(promoted.account.id).toBe(created.account.id);
    expect(promoted.account.account_type).toBe("sandbox");
    expect(promoted.bootstrap).toMatchObject({
      status: "converted",
      account_id: created.account.id,
      review_expires_at: null,
      expires_at: null,
      content_expires_at: null,
    });
    expect(await prisma.account.count({ where: { name: "Evergreen Roofing" } })).toBe(1);
    expect(await prisma.account.count({ where: { id: created.account.id, account_type: "customer" } })).toBe(0);

    const approvedSeedFacts = await prisma.knowledgeFact.findMany({
      where: {
        account_id: created.account.id,
        bootstrap_id: created.bootstrap.id,
        status: { in: ["operator_approved_for_demo", "owner_confirmed"] },
      },
    });
    expect(approvedSeedFacts.length).toBeGreaterThan(0);
    expect(approvedSeedFacts.every((fact) => fact.expires_at === null)).toBe(true);
    expect((await prisma.knowledgeSource.findUnique({ where: { id: websiteSource.id } }))?.expires_at).toEqual(websiteSource.expires_at);

    const assessment = await prisma.assessmentReport.create({
      data: {
        account_id: created.account.id,
        inputs_json: { discoverySession: "founder-01" },
        current_workflow_map: { inboundCalls: "owner mobile" },
        recommended_workflow_map: { inboundCalls: "ResponseOS receptionist" },
      },
    });

    const confirmed = unwrap(await createDiscoveryFinding({
      accountId: created.account.id,
      input: {
        key: "business.hours_summary",
        value: "Sales calls are accepted Monday-Friday 9am-7pm.",
        evidenceNote: "Owner confirmed the sales-call window during discovery.",
        authority: "client_confirmed",
        assessmentReportId: assessment.id,
        validAsOf: startedAt.toISOString(),
      },
    }, startedAt));
    expect(confirmed.fact).toMatchObject({
      account_id: created.account.id,
      bootstrap_id: created.bootstrap.id,
      status: "owner_confirmed",
      expires_at: null,
    });
    expect(confirmed.source).toMatchObject({
      account_id: created.account.id,
      bootstrap_id: created.bootstrap.id,
      source_type: "manual_reference",
      expires_at: null,
    });

    const stated = unwrap(await createDiscoveryFinding({
      accountId: created.account.id,
      input: {
        key: "policy.emergency",
        value: "Route after-hours emergencies to the owner.",
        evidenceNote: "The owner described an after-hours emergency path; confirmation is still pending.",
        authority: "client_stated",
        assessmentReportId: assessment.id,
      },
    }, startedAt));
    expect(stated.fact.status).toBe("source_observed");

    const firstSnapshot = unwrap(await compileDiscoverySnapshot({
      accountId: created.account.id,
      reviewAcknowledged: true,
    }, startedAt));
    expect(firstSnapshot.memory.businessProfile).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: confirmed.fact.id, status: "owner_confirmed" }),
    ]));
    expect(firstSnapshot.memory.policies.some((fact) => fact.id === stated.fact.id)).toBe(false);

    unwrap(await reviewDiscoveryFinding({
      factId: stated.fact.id,
      input: { decision: "owner_confirmed" },
    }, new Date("2026-08-22T18:00:00.000Z")));
    const secondSnapshot = unwrap(await compileDiscoverySnapshot({
      accountId: created.account.id,
      reviewAcknowledged: true,
    }, new Date("2026-08-22T18:05:00.000Z")));
    expect(secondSnapshot.memory.policies).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: stated.fact.id, status: "owner_confirmed" }),
    ]));

    const manifest = unwrap(await buildClientEnvironmentManifest(created.account.id, new Date("2026-08-22T18:10:00.000Z")));
    expect(manifest).toMatchObject({
      accountId: created.account.id,
      sourceBootstrapId: created.bootstrap.id,
      lifecycleStage: "discovery",
      agent: { executionMode: "DISCOVERY_PREVIEW", liveActivationAuthorized: false },
      integrations: { crm: "disabled", scheduling: "disabled", payments: "disabled" },
      promotion: { tenantIdentityPreserved: true, requiresSeparateLiveGate: true },
    });
    expect(manifest.discovery.assessmentReportIds).toContain(assessment.id);
    expect(manifest.discovery.discoverySourceCount).toBe(2);
    expect(manifest.context.snapshotVersion).toBe(secondSnapshot.snapshot.version);
  });

  test("rejects diagnostic evidence attached to another tenant", async () => {
    const alpha = await prepareCompletedBootstrap();
    unwrap(await promoteProspectToDiscovery({ bootstrapId: alpha.bootstrap.id, promotionAcknowledged: true }, startedAt));
    const beta = await prisma.account.create({
      data: {
        name: "Other Tenant",
        slug: "other-tenant-client-environment-test",
        industry: "home-services",
        timezone: "America/New_York",
        status: "lead",
        account_type: "sandbox",
      },
    });
    const assessment = await prisma.assessmentReport.create({
      data: { account_id: beta.id, inputs_json: { note: "belongs elsewhere" } },
    });

    const result = await createDiscoveryFinding({
      accountId: alpha.account.id,
      input: {
        key: "policy.routing",
        value: "Route to estimator.",
        evidenceNote: "Cross-tenant evidence should fail.",
        authority: "consultant_observed",
        assessmentReportId: assessment.id,
      },
    }, startedAt);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("assessment_out_of_scope");
  });
});
