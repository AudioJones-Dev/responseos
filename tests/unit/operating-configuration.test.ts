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
  WeeklyOperatingHoursSchema, HolidayOperatingHoursSchema, isOperatingConfigurationKey,
} from "@/lib/agentExecution/operatingConfiguration";
import { EXECUTION_MODES, EXECUTION_MODE_ACTIVATION_GATES } from "@/lib/agentExecution/policy";

const now = "2026-09-10T16:00:00.000Z";

test("configuration rejects inherited keys and contradictory duplicate schedules", () => {
  for (const key of ["constructor", "toString", "__proto__"]) expect(isOperatingConfigurationKey(key)).toBe(false);
  expect(WeeklyOperatingHoursSchema.safeParse({ type: "schedule", timezone: "America/New_York", days: [{ day: "monday", closed: true }, { day: "monday", closed: false, opensAt: "09:00", closesAt: "17:00" }] }).success).toBe(false);
  expect(HolidayOperatingHoursSchema.safeParse({ type: "closures", timezone: "America/New_York", closures: [{ date: "2026-12-25", name: "Holiday", closed: true }, { date: "2026-12-25", name: "Holiday", closed: false }] }).success).toBe(false);
});
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

const CONSENT_VALUE = {
  aiDisclosure: "This call is handled by an automated assistant.",
  transcription: { enabled: true },
  recording: { enabled: false },
  refusal: {
    acknowledgement: "Understood, I will not record.",
    stopRecordingWhenSupported: true,
    offer: "transfer_or_callback",
    minimizeCollection: true,
  },
};

const COMPLETE_SUPERVISED_CONFIGURATION = {
  operatingHours: [
    operatorFact("operating_hours.weekly", {
      type: "schedule",
      timezone: "America/New_York",
      days: [{ day: "monday", closed: false, opensAt: "08:00", closesAt: "17:00" }],
    }),
    operatorFact("operating_hours.holidays", { type: "always_open" }),
  ],
  serviceAreas: [
    operatorFact("service_area.coverage", {
      regions: ["Example Region"],
      precision: "broad_region",
      countyInferenceAllowed: false,
      locationConfirmationRequired: true,
      collectFromCaller: ["city", "postal_code"],
    }),
  ],
  contactPaths: [operatorFact("contact.escalation.primary", { name: "Example Owner", phone: "+15555550123" })],
  policies: [operatorFact("policy.consent", CONSENT_VALUE)],
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

  test("treats a required fact whose value does not parse as missing", () => {
    const readiness = evaluateOperatingConfiguration(snapshot({
      ...COMPLETE_SUPERVISED_CONFIGURATION,
      operatingHours: [
        operatorFact("operating_hours.weekly", null),
        operatorFact("operating_hours.holidays", { type: "always_open" }),
      ],
      contactPaths: [operatorFact("contact.escalation.primary", {})],
      policies: [operatorFact("policy.consent", "   ")],
    }), "SUPERVISED_PILOT");
    expect(readiness.ready).toBe(false);
    expect(readiness.missing).toEqual(["operating_hours.weekly", "contact.escalation", "policy.consent"]);
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
