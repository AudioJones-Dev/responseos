import { describe, expect, test } from "vitest";
import {
  BusinessMemorySnapshotSchema,
  PROSPECT_BOOTSTRAP_SCHEMA_VERSION,
  type BusinessMemorySnapshot,
} from "@/lib/prospectBootstrap/contracts";
import { PROSPECT_DEMO_POLICY } from "@/lib/prospectBootstrap/policy";
import { EXECUTION_MODE_POLICIES } from "@/lib/agentExecution/policy";
import {
  evaluateOperatingConfiguration,
  parseOperatingConfigurationValue,
  readOperatingConfigurationValue,
} from "@/lib/agentExecution/operatingConfiguration";
import {
  buildOperatingConfigurationSnapshot,
  type OperatingConfigurationInput,
} from "@/lib/agentExecution/operatingConfigurationSnapshot";
import {
  authorizedExecutionGates,
  executionModeFromProfilePolicy,
  resolveTenantExecutionPolicy,
} from "@/lib/agentExecution/tenantPolicy";
import {
  SUPERVISED_RECEPTIONIST_TEMPLATE,
  SUPERVISED_RECEPTIONIST_TEMPLATE_CHECKSUM,
  SUPERVISED_RECEPTIONIST_TEMPLATE_VERSION,
  validateSupervisedAssistantPreflight,
} from "@/lib/agentExecution/supervisedTemplate";
import { buildSupervisedAgentContext, SUPERVISED_UNAVAILABLE_CONTEXT, SupervisedAgentContextSchema } from "@/lib/agentExecution/supervisedContext";

const GATE = "v0.3-live-communications";
const now = new Date("2026-09-11T12:00:00.000Z");

test("approved knowledge reaches the assistant while operational recipients remain private", () => {
  const memory = snapshot([...ENTRIES, { key: "business.knowledge", value: {
    facts: [{ topic: "Ramp evaluations", statement: "An approved example evaluation includes an access discussion.", sourceRef: "owner-approved-example" }],
    fictionalScenarios: [{ reference: "DEMO-PROJECT-1", statement: "A fictional ramp project awaits a callback.", fictional: true }],
  } }]);
  const context = buildSupervisedAgentContext({ businessName: "Example", agentName: "Sam", memory, policy: EXECUTION_MODE_POLICIES.SUPERVISED_PILOT });
  expect(context.approved_business_context).toContain("owner-approved-example");
  expect(context.approved_business_context).toContain("FICTIONAL DEMO RECORD [DEMO-PROJECT-1]");
  expect(context.approved_business_context).not.toContain("+15555550123");
});

test("knowledge needs a source and fictional records cannot masquerade as real history", () => {
  expect(parseOperatingConfigurationValue("business.knowledge", { facts: [{ topic: "Service", statement: "A statement", sourceRef: "" }], fictionalScenarios: [] }).ok).toBe(false);
  expect(parseOperatingConfigurationValue("business.knowledge", { facts: [{ topic: "Service", statement: "A statement", sourceRef: "approval" }], fictionalScenarios: [{ reference: "one", statement: "A project", fictional: false }] }).ok).toBe(false);
});

const CONSENT_RECORDING_OFF = {
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

const CONSENT_RECORDING_ON = {
  ...CONSENT_RECORDING_OFF,
  recording: {
    enabled: true,
    disclosure: "This call is being recorded and may be transcribed for quality and service purposes.",
    continuationStatement: "Staying on the line means the recording continues.",
    retentionDays: 90,
  },
};

const ENTRIES: OperatingConfigurationInput[] = [
  { key: "operating_hours.weekly", value: { type: "always_open" } },
  { key: "operating_hours.holidays", value: { type: "always_open" } },
  {
    key: "service_area.coverage",
    value: {
      regions: ["Example Region", "Second Region"],
      precision: "broad_region",
      countyInferenceAllowed: false,
      locationConfirmationRequired: true,
      collectFromCaller: ["city", "postal_code"],
    },
  },
  { key: "contact.escalation.primary", value: { name: "Example Owner", phone: "+15555550123" } },
  { key: "policy.consent", value: CONSENT_RECORDING_OFF },
];

function snapshot(entries = ENTRIES): BusinessMemorySnapshot {
  return buildOperatingConfigurationSnapshot({
    accountId: "account-test",
    generatedAt: now,
    entries,
    assertion: {
      sourceId: "operator-configuration:account-test",
      recordRef: "approval-record:test",
      contentHash: "c".repeat(64),
      assertedBy: "operator-1",
      assertedAt: now,
    },
  }).memory;
}

describe("typed operating configuration", () => {
  test("rejects a free-text value where a machine-readable one is required", () => {
    const parsed = parseOperatingConfigurationValue("operating_hours.weekly", "open 24/7");
    expect(parsed.ok).toBe(false);
  });

  test("rejects placeholder text inside an otherwise valid shape", () => {
    for (const placeholder of ["TBD", "n/a", "TODO", "{{escalation_name}}", "<name>"]) {
      const parsed = parseOperatingConfigurationValue("contact.escalation.primary", {
        name: placeholder,
        phone: "+15555550123",
      });
      expect(parsed.ok, placeholder).toBe(false);
    }
  });

  test("rejects an escalation contact whose phone is not E.164", () => {
    expect(
      parseOperatingConfigurationValue("contact.escalation.primary", {
        name: "Example Owner",
        phone: "(555) 555-0123",
      }).ok,
    ).toBe(false);
  });

  test("rejects a coverage value that permits county inference", () => {
    expect(
      parseOperatingConfigurationValue("service_area.coverage", {
        regions: ["Example Region"],
        precision: "broad_region",
        countyInferenceAllowed: true,
        locationConfirmationRequired: true,
        collectFromCaller: ["city"],
      }).ok,
    ).toBe(false);
  });

  test("requires disclosure, continuation, and retention once recording is enabled", () => {
    expect(
      parseOperatingConfigurationValue("policy.consent", {
        ...CONSENT_RECORDING_OFF,
        recording: { enabled: true },
      }).ok,
    ).toBe(false);
    expect(parseOperatingConfigurationValue("policy.consent", CONSENT_RECORDING_ON).ok).toBe(true);
  });

  test("builds an approved snapshot whose facts all cite the operator record", () => {
    const built = buildOperatingConfigurationSnapshot({
      accountId: "account-test",
      generatedAt: now,
      entries: ENTRIES,
      assertion: {
        sourceId: "operator-configuration:account-test",
        recordRef: "approval-record:test",
        contentHash: "c".repeat(64),
        assertedBy: "operator-1",
        assertedAt: now,
      },
    });
    expect(built.rejected).toEqual([]);
    expect(built.memory.unknowns).toEqual([]);
    expect(built.memory.bootstrapId).toBeNull();
    const facts = [...built.memory.operatingHours, ...built.memory.serviceAreas, ...built.memory.policies, ...built.memory.contactPaths];
    expect(facts).toHaveLength(5);
    for (const fact of facts) {
      expect(fact.status).toBe("operator_configured");
      expect(fact.sourceEvidence[0]).toMatchObject({ kind: "operator_assertion", recordRef: "approval-record:test" });
    }
    expect(evaluateOperatingConfiguration(built.memory, "SUPERVISED_PILOT")).toEqual({
      ready: true,
      missing: [],
      conflicts: [],
    });
  });

  test("names every rejected entry without echoing its value", () => {
    const built = buildOperatingConfigurationSnapshot({
      accountId: "account-test",
      generatedAt: now,
      entries: [
        { key: "contact.escalation.primary", value: { name: "Example Owner", phone: "5555550123" } },
        { key: "unsupported.key", value: "anything" },
      ],
      assertion: {
        sourceId: "operator-configuration:account-test",
        recordRef: "approval-record:test",
        contentHash: "c".repeat(64),
        assertedBy: "operator-1",
        assertedAt: now,
      },
    });
    expect(built.rejected).toHaveLength(2);
    expect(built.rejected.join(" ")).toContain("unsupported_configuration_key");
    expect(built.rejected.join(" ")).not.toContain("5555550123");
    expect(evaluateOperatingConfiguration(built.memory, "SUPERVISED_PILOT").ready).toBe(false);
  });

  test("keeps the snapshot hash stable for the same configuration", () => {
    const first = buildOperatingConfigurationSnapshot({
      accountId: "account-test",
      generatedAt: now,
      entries: ENTRIES,
      assertion: {
        sourceId: "operator-configuration:account-test",
        recordRef: "approval-record:test",
        contentHash: "c".repeat(64),
        assertedBy: "operator-1",
        assertedAt: now,
      },
    });
    const second = buildOperatingConfigurationSnapshot({
      accountId: "account-test",
      generatedAt: now,
      entries: [...ENTRIES].reverse(),
      assertion: {
        sourceId: "operator-configuration:account-test",
        recordRef: "approval-record:test",
        contentHash: "c".repeat(64),
        assertedBy: "operator-1",
        assertedAt: now,
      },
    });
    expect(second.hash).toBe(first.hash);
    expect(BusinessMemorySnapshotSchema.parse(first.memory).schemaVersion).toBe(PROSPECT_BOOTSTRAP_SCHEMA_VERSION);
  });
});

describe("tenant execution policy", () => {
  test("reads the gates from the lane environment and treats an absent value as none", () => {
    expect(authorizedExecutionGates({})).toEqual([]);
    expect(authorizedExecutionGates({ RESPONSEOS_AUTHORIZED_EXECUTION_GATES: ` ${GATE} , other ` })).toEqual([
      GATE,
      "other",
    ]);
  });

  test("accepts a stored policy only when it matches the table byte for byte", () => {
    expect(executionModeFromProfilePolicy(EXECUTION_MODE_POLICIES.SUPERVISED_PILOT)).toBe("SUPERVISED_PILOT");
    expect(
      executionModeFromProfilePolicy({ ...EXECUTION_MODE_POLICIES.SUPERVISED_PILOT, paymentEnabled: true }),
    ).toBeNull();
    expect(executionModeFromProfilePolicy({ executionMode: "SUPERVISED_PILOT" })).toBeNull();
    expect(executionModeFromProfilePolicy(null)).toBeNull();
  });

  test("degrades to the demo lane when the gate is not authorized", () => {
    const resolved = resolveTenantExecutionPolicy({
      profilePolicy: EXECUTION_MODE_POLICIES.SUPERVISED_PILOT,
      memory: snapshot(),
      authorizedGates: [],
    });
    expect(resolved.policy).toBe(PROSPECT_DEMO_POLICY);
    expect(resolved.mode).toBe("PROSPECT_DEMO");
    expect(resolved.degraded).toBe("gate_not_authorized");
    expect(resolved.policy.crmSyncEnabled).toBe(false);
  });

  test("degrades to the demo lane when a stored policy was tampered with", () => {
    const resolved = resolveTenantExecutionPolicy({
      profilePolicy: { ...EXECUTION_MODE_POLICIES.SUPERVISED_PILOT, recordingEnabled: true },
      memory: snapshot(),
      authorizedGates: [GATE],
    });
    expect(resolved.degraded).toBe("policy_checksum_mismatch");
    expect(resolved.policy.recordingEnabled).toBe(false);
  });

  test("keeps recording off when the tenant has not configured it", () => {
    const resolved = resolveTenantExecutionPolicy({
      profilePolicy: EXECUTION_MODE_POLICIES.SUPERVISED_PILOT,
      memory: snapshot(),
      authorizedGates: [GATE],
    });
    expect(resolved.mode).toBe("SUPERVISED_PILOT");
    expect(resolved.policy.recordingEnabled).toBe(false);
    expect(resolved.recordingSource).toBe("policy_default");
  });

  test("keeps recording off even when configuration requests it", () => {
    const configured = snapshot([
      ...ENTRIES.filter((entry) => entry.key !== "policy.consent"),
      { key: "policy.consent", value: CONSENT_RECORDING_ON },
    ]);
    const resolved = resolveTenantExecutionPolicy({
      profilePolicy: EXECUTION_MODE_POLICIES.SUPERVISED_PILOT,
      memory: configured,
      authorizedGates: [GATE],
    });
    expect(resolved.policy.recordingEnabled).toBe(false);
    expect(resolved.recordingSource).toBe("policy_default");
    expect(resolved.policy.requiredDisclosure).not.toContain("being recorded");
    // The shared policy table is never mutated by a tenant override.
    expect(EXECUTION_MODE_POLICIES.SUPERVISED_PILOT.recordingEnabled).toBe(false);
  });

  test("never turns recording on for the demo lane, whatever its snapshot says", () => {
    const configured = snapshot([
      ...ENTRIES.filter((entry) => entry.key !== "policy.consent"),
      { key: "policy.consent", value: CONSENT_RECORDING_ON },
    ]);
    const resolved = resolveTenantExecutionPolicy({
      profilePolicy: PROSPECT_DEMO_POLICY,
      memory: configured,
      authorizedGates: [GATE],
    });
    expect(resolved.mode).toBe("PROSPECT_DEMO");
    expect(resolved.policy.recordingEnabled).toBe(false);
  });
});

describe("supervised assistant preflight", () => {
  const attested = {
    assistantId: "assistant-1",
    templateVersion: SUPERVISED_RECEPTIONIST_TEMPLATE_VERSION,
    templateChecksum: SUPERVISED_RECEPTIONIST_TEMPLATE_CHECKSUM,
    initializationWebhookConfigured: true,
    recordingEnabled: false,
    providerMemoryEnabled: false,
    allowedTools: ["hangup", "transfer"],
    transferDestinationE164: "+1 (555) 555-0123",
    insightGroupConfigured: true,
    messageHistoryUpdatesEnabled: true,
    numberRecordingEnabled: false,
    consentCaptureVerified: true,
    captureIntervalVerified: true,
    consentEvidenceRef: "test-evidence-only",
  };

  test("the fail-closed context terminates the call and satisfies every template variable", () => {
    const lines = SUPERVISED_RECEPTIONIST_TEMPLATE.instructions.split("\n");
    expect(lines[0]).toContain("supervised_available is false");
    expect(lines[0]).toContain("hangup");
    expect(lines[0]).toContain("{{uncertainty_fallback}}");
    const referenced = [...SUPERVISED_RECEPTIONIST_TEMPLATE.instructions.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]);
    for (const variable of new Set([...referenced, ...SUPERVISED_RECEPTIONIST_TEMPLATE.dynamicVariables])) {
      expect(SUPERVISED_RECEPTIONIST_TEMPLATE.dynamicVariables, variable).toContain(variable);
      expect(Object.keys(SUPERVISED_UNAVAILABLE_CONTEXT), variable).toContain(variable);
      expect(Object.keys(SupervisedAgentContextSchema.shape), variable).toContain(variable);
    }
    expect(SUPERVISED_UNAVAILABLE_CONTEXT.supervised_available).toBe("false");
    expect(JSON.stringify(SUPERVISED_UNAVAILABLE_CONTEXT)).not.toMatch(/demo/i);
  });

  test("the attested template speaks the approved AI disclosure before any collection", () => {
    const lines = SUPERVISED_RECEPTIONIST_TEMPLATE.instructions.split("\n");
    const disclosureLine = lines.findIndex((line) => line.includes("{{ai_disclosure}}"));
    expect(disclosureLine).toBeGreaterThan(-1);
    const collectionLine = lines.findIndex((line) => line.includes("Ask who is calling"));
    expect(collectionLine).toBeGreaterThan(disclosureLine);
    // An explicit consent question with a refusal branch sits between the
    // disclosure and any collection, and uses the configured refusal wording.
    const consentLine = lines.findIndex((line) => line.includes("Is it okay to continue?"));
    expect(consentLine).toBeGreaterThan(disclosureLine);
    expect(consentLine).toBeLessThan(collectionLine);
    expect(lines[consentLine]).toContain("{{recording_refusal_acknowledgement}}");
    expect(lines[consentLine]).toContain("{{recording_refusal_offer}}");
    expect(lines[consentLine]).toMatch(/Do not ask for or record any details after a refusal/);
    // Location collection defers to the configured service-area statement
    // rather than naming fields the operator may not have approved.
    expect(SUPERVISED_RECEPTIONIST_TEMPLATE.instructions).not.toMatch(/city and postal code/);
    expect(lines.find((line) => line.startsWith("Never infer a service area"))).toContain("{{service_area_statement}}");
    expect(SUPERVISED_RECEPTIONIST_TEMPLATE.dynamicVariables).toContain("ai_disclosure");
    expect(SUPERVISED_RECEPTIONIST_TEMPLATE_VERSION).toBe("supervised-receptionist.v3");
  });

  test("accepts provider configuration that matches the resolved policy", () => {
    expect(
      validateSupervisedAssistantPreflight(attested, {
        recordingEnabled: false,
        allowedTools: ["hangup", "transfer"],
        transferDestination: "+15555550123",
      }).assistantId,
    ).toBe("assistant-1");
  });

  test("rejects recording that the tenant did not configure, at the assistant or the number", () => {
    expect(() =>
      validateSupervisedAssistantPreflight({ ...attested, recordingEnabled: true }, {
        recordingEnabled: false,
        allowedTools: ["hangup", "transfer"],
        transferDestination: "+15555550123",
      }),
    ).toThrow("assistant_recording_policy_mismatch");
    expect(() =>
      validateSupervisedAssistantPreflight({ ...attested, numberRecordingEnabled: true }, {
        recordingEnabled: false,
        allowedTools: ["hangup", "transfer"],
        transferDestination: "+15555550123",
      }),
    ).toThrow("number_recording_policy_mismatch");
  });

  test("rejects recording the tenant configured but the provider did not enable", () => {
    expect(() =>
      validateSupervisedAssistantPreflight(attested, {
        recordingEnabled: true,
        allowedTools: ["hangup", "transfer"],
        transferDestination: "+15555550123",
      }),
    ).toThrow("assistant_recording_policy_mismatch");
  });

  test("binds the transfer tool to the approved escalation contact", () => {
    const expectation = { recordingEnabled: false, allowedTools: ["hangup", "transfer"], transferDestination: "+15555550123" };
    expect(validateSupervisedAssistantPreflight(attested, expectation).transferDestinationE164).toBe("+1 (555) 555-0123");
    expect(() => validateSupervisedAssistantPreflight({ ...attested, transferDestinationE164: "+15555550999" }, expectation)).toThrow("assistant_transfer_destination_mismatch");
    expect(() => validateSupervisedAssistantPreflight({ ...attested, transferDestinationE164: undefined }, expectation)).toThrow("assistant_transfer_destination_mismatch");
    expect(() => validateSupervisedAssistantPreflight(attested, { ...expectation, transferDestination: null })).toThrow("escalation_contact_required_for_transfer");
    expect(validateSupervisedAssistantPreflight({ ...attested, allowedTools: ["hangup"], transferDestinationE164: undefined }, { recordingEnabled: false, allowedTools: ["hangup"] }).assistantId).toBe("assistant-1");
  });

  test("rejects a tool beyond the policy, memory, or a missing insight group", () => {
    expect(() =>
      validateSupervisedAssistantPreflight({ ...attested, allowedTools: ["hangup", "transfer", "pay"] }, {
        recordingEnabled: false,
        allowedTools: ["hangup", "transfer"],
        transferDestination: "+15555550123",
      }),
    ).toThrow("assistant_tools_exceed_policy");
    for (const allowedTools of [[], ["hangup"]]) {
      expect(() =>
        validateSupervisedAssistantPreflight({ ...attested, allowedTools }, {
          recordingEnabled: false,
          allowedTools: ["hangup", "transfer"],
        transferDestination: "+15555550123",
        }),
      ).toThrow("assistant_tools_missing_policy_tool");
    }
    expect(() =>
      validateSupervisedAssistantPreflight({ ...attested, providerMemoryEnabled: true }, {
        recordingEnabled: false,
        allowedTools: ["hangup", "transfer"],
        transferDestination: "+15555550123",
      }),
    ).toThrow("assistant_provider_memory_must_be_disabled");
    expect(() =>
      validateSupervisedAssistantPreflight({ ...attested, insightGroupConfigured: false }, {
        recordingEnabled: false,
        allowedTools: ["hangup", "transfer"],
        transferDestination: "+15555550123",
      }),
    ).toThrow("assistant_insight_group_missing");
  });
});

describe("supervised agent context", () => {
  test("carries the approved configuration and never the escalation contact", () => {
    const memory = snapshot([
      ...ENTRIES,
      {
        key: "notification.completed_interaction.recipient",
        value: {
          channel: "email",
          recipient: "owner@example.test",
          event: "completed_interaction",
          enabled: true,
          temporary: true,
        },
      },
    ]);
    const context = buildSupervisedAgentContext({
      businessName: "Example Business",
      agentName: "Sam",
      memory,
      policy: EXECUTION_MODE_POLICIES.SUPERVISED_PILOT,
    });
    const serialized = JSON.stringify(context);
    expect(context.agent_name).toBe("Sam");
    expect(context.recording_enabled).toBe("false");
    expect(context.service_area_statement).toContain("Do not infer coverage");
    expect(context.location_confirmation_required).toBe("true");
    expect(serialized).not.toContain("+15555550123");
    expect(serialized).not.toContain("Example Owner");
    expect(serialized).not.toContain("owner@example.test");
    // The recipient is still configured; it simply never reaches the provider.
    expect(readOperatingConfigurationValue(memory, "notification.completed_interaction.recipient")?.recipient)
      .toBe("owner@example.test");
  });

  test("never claims recording is enabled from configuration alone", () => {
    const memory = snapshot([
      ...ENTRIES.filter((entry) => entry.key !== "policy.consent"),
      { key: "policy.consent", value: CONSENT_RECORDING_ON },
    ]);
    const resolved = resolveTenantExecutionPolicy({
      profilePolicy: EXECUTION_MODE_POLICIES.SUPERVISED_PILOT,
      memory,
      authorizedGates: [GATE],
    });
    const context = buildSupervisedAgentContext({
      businessName: "Example Business",
      agentName: "Sam",
      memory,
      policy: resolved.policy,
    });
    expect(context.recording_enabled).toBe("false");
    expect(context.recording_disclosure).toBe("");
    expect(context.recording_refusal_offer).toBe("transfer_or_callback");
  });
});
