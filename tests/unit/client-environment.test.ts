import { describe, expect, test } from "vitest";
import {
  CLIENT_ENVIRONMENT_SCHEMA_VERSION,
  CLIENT_ENVIRONMENT_TEMPLATE_VERSION,
  ClientEnvironmentManifestSchema,
  DiscoveryFindingInputSchema,
} from "@/lib/clientEnvironment/contracts";
import { PROSPECT_AGENT_TEMPLATE_VERSION } from "@/lib/prospectBootstrap/contracts";
import { compileBusinessMemorySnapshot } from "@/lib/prospectBootstrap/memory";

const now = new Date("2026-08-22T17:00:00.000Z");

function source(id: string, url: string) {
  return {
    id,
    normalized_url: url,
    content_hash: id.padEnd(64, "a").slice(0, 64),
    fetched_at: now,
  };
}

describe("progressive business context", () => {
  test("owner-confirmed discovery evidence supersedes lower-authority public context for single-value facts", () => {
    const website = source("w", "https://business.example/");
    const discovery = source("d", "https://evidence.responseos.invalid/assessment/a/bootstrap/d");
    const compiled = compileBusinessMemorySnapshot({
      bootstrapId: "bootstrap-1",
      accountId: "account-1",
      generatedAt: now,
      sources: [website, discovery],
      unknowns: [],
      facts: [
        {
          id: "website-hours",
          fact_key: "business.hours_summary",
          value_json: "Mon-Fri 9-5",
          status: "operator_approved_for_demo",
          source_id: website.id,
          reviewed_by: "operator-1",
          reviewed_at: new Date("2026-08-20T17:00:00.000Z"),
        },
        {
          id: "discovery-hours",
          fact_key: "business.hours_summary",
          value_json: "Sales calls Mon-Fri 9-7",
          status: "owner_confirmed",
          source_id: discovery.id,
          reviewed_by: "operator-1",
          reviewed_at: new Date("2026-08-22T17:00:00.000Z"),
        },
      ],
    });

    expect(compiled.memory.businessProfile).toHaveLength(1);
    expect(compiled.memory.businessProfile[0]).toMatchObject({
      id: "discovery-hours",
      value: "Sales calls Mon-Fri 9-7",
      status: "owner_confirmed",
    });
  });

  test("multi-value facts retain distinct values while deduplicating the same value by authority", () => {
    const website = source("w", "https://business.example/");
    const discovery = source("d", "https://evidence.responseos.invalid/session/manual/bootstrap/d");
    const compiled = compileBusinessMemorySnapshot({
      bootstrapId: "bootstrap-1",
      accountId: "account-1",
      generatedAt: now,
      sources: [website, discovery],
      unknowns: [],
      facts: [
        {
          id: "service-web",
          fact_key: "service.statement",
          value_json: "Roof repair",
          status: "operator_approved_for_demo",
          source_id: website.id,
          reviewed_by: "operator-1",
          reviewed_at: now,
        },
        {
          id: "service-confirmed",
          fact_key: "service.statement",
          value_json: "Roof repair",
          status: "owner_confirmed",
          source_id: discovery.id,
          reviewed_by: "operator-1",
          reviewed_at: now,
        },
        {
          id: "service-two",
          fact_key: "service.statement",
          value_json: "Emergency tarp service",
          status: "owner_confirmed",
          source_id: discovery.id,
          reviewed_by: "operator-1",
          reviewed_at: now,
        },
      ],
    });

    expect(compiled.memory.services).toHaveLength(2);
    expect(compiled.memory.services).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "service-confirmed", value: "Roof repair", status: "owner_confirmed" }),
      expect.objectContaining({ id: "service-two", value: "Emergency tarp service", status: "owner_confirmed" }),
    ]));
    expect(compiled.memory.services.some((fact) => fact.id === "service-web")).toBe(false);
  });
});

describe("client environment contracts", () => {
  test("accepts structured discovery input and rejects malformed fact keys", () => {
    expect(DiscoveryFindingInputSchema.parse({
      key: "policy.after_hours",
      value: "Route emergencies to the owner.",
      evidenceNote: "Owner confirmed after-hours emergency routing during discovery.",
      authority: "client_confirmed",
      assessmentReportId: "assessment-1",
    })).toMatchObject({ authority: "client_confirmed" });

    expect(() => DiscoveryFindingInputSchema.parse({
      key: "Bad Key",
      value: true,
      evidenceNote: "Observed",
      authority: "consultant_observed",
    })).toThrow();
  });

  test("portable manifest is explicitly non-live and preserves tenant identity", () => {
    const memory = compileBusinessMemorySnapshot({
      bootstrapId: "bootstrap-1",
      accountId: "account-1",
      generatedAt: now,
      sources: [source("w", "https://business.example/")],
      unknowns: [],
      facts: [{
        id: "business-name",
        fact_key: "business.name",
        value_json: "Example Roofing",
        status: "operator_approved_for_demo",
        source_id: "w",
        reviewed_by: "operator-1",
        reviewed_at: now,
      }],
    }).memory;

    const manifest = ClientEnvironmentManifestSchema.parse({
      schemaVersion: CLIENT_ENVIRONMENT_SCHEMA_VERSION,
      templateVersion: CLIENT_ENVIRONMENT_TEMPLATE_VERSION,
      generatedAt: now.toISOString(),
      accountId: "account-1",
      sourceBootstrapId: "bootstrap-1",
      lifecycleStage: "discovery",
      businessIdentity: {
        name: "Example Roofing",
        canonicalWebsite: "https://business.example/",
        industry: "home-services",
        timezone: "America/New_York",
      },
      context: {
        snapshotId: "snapshot-2",
        snapshotHash: "a".repeat(64),
        snapshotVersion: 2,
        memory,
      },
      discovery: {
        assessmentReportIds: ["assessment-1"],
        discoverySourceCount: 2,
        approvedFindingCount: 1,
        pendingFindingCount: 1,
      },
      agent: {
        templateVersion: PROSPECT_AGENT_TEMPLATE_VERSION,
        policyHash: "b".repeat(64),
        executionMode: "DISCOVERY_PREVIEW",
        liveActivationAuthorized: false,
      },
      integrations: {
        telephony: "review_required",
        crm: "disabled",
        scheduling: "disabled",
        payments: "disabled",
      },
      promotion: {
        tenantIdentityPreserved: true,
        requiresSeparateLiveGate: true,
      },
    });

    expect(manifest.accountId).toBe(memory.accountId);
    expect(manifest.agent.liveActivationAuthorized).toBe(false);
    expect(manifest.promotion.tenantIdentityPreserved).toBe(true);
  });
});
