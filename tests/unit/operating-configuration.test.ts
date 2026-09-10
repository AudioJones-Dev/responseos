import { describe, expect, test } from "vitest";
import {
  BusinessMemorySnapshotSchema,
  PROSPECT_BOOTSTRAP_SCHEMA_VERSION,
  type BusinessMemorySnapshot,
} from "@/lib/prospectBootstrap/contracts";
import { compileBusinessMemorySnapshot, contentHash } from "@/lib/prospectBootstrap/memory";
import {
  OPERATING_CONFIGURATION_REQUIREMENTS,
  evaluateOperatingConfiguration,
} from "@/lib/agentExecution/operatingConfiguration";
import { EXECUTION_MODES, EXECUTION_MODE_ACTIVATION_GATES } from "@/lib/agentExecution/policy";

const now = "2026-09-10T16:00:00.000Z";
const recordRef = "approval-record:operator-session-1";

function operatorFact(key: string, value: unknown) {
  return {
    id: `fact:${key}`,
    key,
    value,
    status: "operator_configured",
    sourceIds: ["operator-record-1"],
    sourceEvidence: [{
      kind: "operator_assertion",
      sourceId: "operator-record-1",
      recordRef,
      contentHash: "c".repeat(64),
      assertedBy: "operator-1",
      assertedAt: now,
    }],
    confidence: null,
    reviewedBy: "operator-1",
    reviewedAt: now,
  };
}

function webEvidence(sourceUrl: string) {
  return {
    sourceId: "source-1",
    sourceUrl,
    contentHash: "a".repeat(64),
    evidenceExcerptHash: "b".repeat(64),
    fetchedAt: now,
  };
}

function snapshot(sections: Partial<Record<keyof BusinessMemorySnapshot, unknown>> = {}): BusinessMemorySnapshot {
  return BusinessMemorySnapshotSchema.parse({
    schemaVersion: PROSPECT_BOOTSTRAP_SCHEMA_VERSION,
    bootstrapId: null,
    accountId: "account-1",
    generatedAt: now,
    businessProfile: [],
    services: [],
    locations: [],
    operatingHours: [],
    serviceAreas: [],
    faqs: [],
    policies: [],
    contactPaths: [],
    brandVoice: [],
    unknowns: [],
    conflicts: [],
    agentBoundaries: [],
    sourceManifest: [],
    ...sections,
  });
}

const COMPLETE_SUPERVISED_CONFIGURATION = {
  operatingHours: [
    operatorFact("operating_hours.weekly", { monday: "08:00-17:00" }),
    operatorFact("operating_hours.holidays", []),
  ],
  serviceAreas: [operatorFact("service_area.coverage", ["Example County"])],
  contactPaths: [operatorFact("contact.escalation.primary", { role: "owner" })],
  policies: [operatorFact("policy.consent.disclosure", "automated_assistant_disclosed")],
};

describe("operator-asserted configuration on the memory snapshot", () => {
  test("leaves the content hash of an existing web-sourced snapshot unchanged", () => {
    const compiled = compileBusinessMemorySnapshot({
      bootstrapId: "bootstrap-1",
      accountId: "account-1",
      generatedAt: new Date(now),
      sources: [{ id: "source-1", normalized_url: "https://prospect.example/", content_hash: "a".repeat(64), fetched_at: new Date(now) }],
      unknowns: ["Scheduling is not connected."],
      facts: [{ id: "approved", fact_key: "contact.phone", value_json: "+13055550110", status: "operator_approved_for_demo", source_id: "source-1", evidence_excerpt: "Call 305-555-0110", confidence: 0.9, reviewed_by: "operator-1", reviewed_at: new Date(now) }],
    });
    const stored = JSON.parse(JSON.stringify(compiled.memory));
    expect(contentHash(BusinessMemorySnapshotSchema.parse(stored))).toBe(compiled.hash);
  });

  test("accepts an operator_configured fact that cites an approval record instead of a URL", () => {
    const memory = snapshot({
      operatingHours: [operatorFact("operating_hours.weekly", { monday: "08:00-17:00" })],
      sourceManifest: [{ kind: "operator_assertion", id: "operator-record-1", recordRef, contentHash: "c".repeat(64), assertedAt: now }],
    });
    expect(memory.operatingHours[0].sourceEvidence[0]).toMatchObject({ kind: "operator_assertion", recordRef });
    expect(memory.sourceManifest[0]).toMatchObject({ kind: "operator_assertion", recordRef });
  });

  test("rejects operator-asserted evidence on a demo-approved or owner-confirmed fact", () => {
    for (const status of ["operator_approved_for_demo", "owner_confirmed"] as const) {
      expect(() => snapshot({
        operatingHours: [{ ...operatorFact("operating_hours.weekly", "08:00-17:00"), status }],
      })).toThrow("operator_assertion_requires_operator_configured_status");
    }
  });

  test("rejects an operator_configured fact that cites a web source", () => {
    expect(() => snapshot({
      operatingHours: [{
        ...operatorFact("operating_hours.weekly", "08:00-17:00"),
        sourceEvidence: [webEvidence("https://prospect.example/")],
      }],
    })).toThrow("operator_configured_fact_requires_operator_assertion");
  });

  test("still requires HTTPS for web-sourced evidence and manifest entries", () => {
    expect(() => snapshot({
      contactPaths: [{
        ...operatorFact("contact.phone", "+13055550110"),
        status: "owner_confirmed",
        sourceEvidence: [webEvidence("http://prospect.example/")],
      }],
    })).toThrow();
    expect(() => snapshot({
      sourceManifest: [{ id: "source-1", url: "http://prospect.example/", contentHash: "a".repeat(64), fetchedAt: now }],
    })).toThrow();
  });
});

describe("operating configuration readiness", () => {
  test("adds no requirement to the prospect demo lane", () => {
    expect(evaluateOperatingConfiguration(snapshot(), "PROSPECT_DEMO")).toEqual({ ready: true, missing: [], conflicts: [] });
  });

  test("reports every missing item for a supervised pilot with an empty snapshot", () => {
    const readiness = evaluateOperatingConfiguration(snapshot(), "SUPERVISED_PILOT");
    expect(readiness.ready).toBe(false);
    expect(readiness.missing).toEqual([...OPERATING_CONFIGURATION_REQUIREMENTS.SUPERVISED_PILOT]);
  });

  test("is ready once every required item has an approved fact", () => {
    expect(evaluateOperatingConfiguration(snapshot(COMPLETE_SUPERVISED_CONFIGURATION), "SUPERVISED_PILOT"))
      .toEqual({ ready: true, missing: [], conflicts: [] });
  });

  test("matches a requirement by whole key segment, not by string prefix", () => {
    const readiness = evaluateOperatingConfiguration(snapshot({
      ...COMPLETE_SUPERVISED_CONFIGURATION,
      contactPaths: [operatorFact("contact.escalation_backup", { role: "office" })],
    }), "SUPERVISED_PILOT");
    expect(readiness.missing).toEqual(["contact.escalation"]);
  });

  test("blocks readiness while the snapshot records a conflict", () => {
    const readiness = evaluateOperatingConfiguration(snapshot({
      ...COMPLETE_SUPERVISED_CONFIGURATION,
      conflicts: ["operating_hours.weekly"],
    }), "SUPERVISED_PILOT");
    expect(readiness).toEqual({ ready: false, missing: [], conflicts: ["operating_hours.weekly"] });
  });

  test("evaluates an unrecognised mode against the supervised requirements", () => {
    expect(evaluateOperatingConfiguration(snapshot(), "AUTONOMY_PLEASE").missing)
      .toEqual([...OPERATING_CONFIGURATION_REQUIREMENTS.SUPERVISED_PILOT]);
  });

  test("requires at least the supervised pilot configuration for every gated mode", () => {
    for (const mode of EXECUTION_MODES.filter((candidate) => EXECUTION_MODE_ACTIVATION_GATES[candidate] !== null)) {
      expect(OPERATING_CONFIGURATION_REQUIREMENTS[mode])
        .toEqual(expect.arrayContaining([...OPERATING_CONFIGURATION_REQUIREMENTS.SUPERVISED_PILOT]));
    }
  });
});
