import { describe, expect, test } from "vitest";
import {
  CAPABILITIES,
  INBOUND_LEAD_QUALIFICATION_CAPABILITY,
  RECEPTIONIST_CAPABILITY,
  capabilityChecksum,
  effectiveAllowedTools,
  validateCapabilityGovernance,
  type CapabilityDescriptor,
} from "@/lib/capabilities";
import { PROSPECT_DEMO_POLICY } from "@/lib/prospectBootstrap/policy";
import { PROSPECT_RECEPTIONIST_TEMPLATE } from "@/lib/prospectBootstrap/template";

function mutate(
  base: CapabilityDescriptor,
  overrides: Partial<CapabilityDescriptor>,
): CapabilityDescriptor {
  return { ...base, ...overrides } as CapabilityDescriptor;
}

describe("capability checksum", () => {
  test("is stable across key order", () => {
    const reordered = {
      producesRecords: RECEPTIONIST_CAPABILITY.producesRecords,
      slug: RECEPTIONIST_CAPABILITY.slug,
      name: RECEPTIONIST_CAPABILITY.name,
      versionLabel: RECEPTIONIST_CAPABILITY.versionLabel,
      objective: RECEPTIONIST_CAPABILITY.objective,
      triggers: RECEPTIONIST_CAPABILITY.triggers,
      requiredContext: RECEPTIONIST_CAPABILITY.requiredContext,
      requiredKnownFields: RECEPTIONIST_CAPABILITY.requiredKnownFields,
      minimumExecutionMode: RECEPTIONIST_CAPABILITY.minimumExecutionMode,
      allowedTools: RECEPTIONIST_CAPABILITY.allowedTools,
      readinessGate: RECEPTIONIST_CAPABILITY.readinessGate,
    } as CapabilityDescriptor;

    expect(capabilityChecksum(reordered)).toBe(
      capabilityChecksum(RECEPTIONIST_CAPABILITY),
    );
  });

  test("changes when any behaviour-bearing field changes", () => {
    const before = capabilityChecksum(RECEPTIONIST_CAPABILITY);
    const after = capabilityChecksum(
      mutate(RECEPTIONIST_CAPABILITY, { allowedTools: ["hangup", "transfer"] }),
    );
    expect(after).not.toBe(before);
  });

  test("distinguishes the two capabilities", () => {
    expect(capabilityChecksum(RECEPTIONIST_CAPABILITY)).not.toBe(
      capabilityChecksum(INBOUND_LEAD_QUALIFICATION_CAPABILITY),
    );
  });
});

describe("descriptors wrap existing constants rather than restating them", () => {
  test("receptionist tools are read from the shipped policy", () => {
    expect(RECEPTIONIST_CAPABILITY.allowedTools).toBe(
      PROSPECT_DEMO_POLICY.allowedTools,
    );
  });

  test("receptionist version label is read from the shipped template", () => {
    expect(RECEPTIONIST_CAPABILITY.versionLabel).toBe(
      PROSPECT_RECEPTIONIST_TEMPLATE.version,
    );
  });
});

describe("governance validation", () => {
  test("both described capabilities pass", () => {
    for (const capability of CAPABILITIES) {
      expect(validateCapabilityGovernance(capability)).toEqual({
        valid: true,
        violations: [],
      });
    }
  });

  test("rejects a tool the minimum mode withholds", () => {
    const result = validateCapabilityGovernance(
      mutate(RECEPTIONIST_CAPABILITY, { allowedTools: ["hangup", "schedule"] }),
    );
    expect(result.valid).toBe(false);
    expect(result.violations).toContain("tool_not_permitted_by_mode:schedule");
  });

  test("rejects a readiness gate that is not the one the mode requires", () => {
    const result = validateCapabilityGovernance(
      mutate(RECEPTIONIST_CAPABILITY, {
        readinessGate: "v0.3-live-communications",
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.violations).toContain("readiness_gate_mismatch:expected_null");
  });

  test("rejects an unrecognised execution mode without throwing", () => {
    const result = validateCapabilityGovernance(
      mutate(RECEPTIONIST_CAPABILITY, {
        minimumExecutionMode: "TOTALLY_PERMISSIVE" as never,
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.violations).toContain("execution_mode_unrecognised");
  });

  test("rejects a capability with no output contract", () => {
    const result = validateCapabilityGovernance(
      mutate(INBOUND_LEAD_QUALIFICATION_CAPABILITY, { producesRecords: [] }),
    );
    expect(result.valid).toBe(false);
    expect(result.violations).toContain("output_contract_missing");
  });
});

describe("effective tools are an intersection, never a union", () => {
  test("a more permissive mode cannot widen a capability's declared set", () => {
    expect(
      effectiveAllowedTools(RECEPTIONIST_CAPABILITY, "MANAGED_AUTONOMY"),
    ).toEqual(["hangup"]);
  });

  test("an empty declared set stays empty at every mode", () => {
    for (const mode of [
      "PROSPECT_DEMO",
      "SUPERVISED_PILOT",
      "PRODUCTION_SUPERVISED",
      "MANAGED_AUTONOMY",
    ]) {
      expect(
        effectiveAllowedTools(INBOUND_LEAD_QUALIFICATION_CAPABILITY, mode),
      ).toEqual([]);
    }
  });

  test("an unrecognised mode grants nothing", () => {
    expect(effectiveAllowedTools(RECEPTIONIST_CAPABILITY, "nonsense")).toEqual([]);
  });

  test("a tool the mode withholds is dropped rather than granted", () => {
    const overreaching = mutate(RECEPTIONIST_CAPABILITY, {
      allowedTools: ["hangup", "schedule"],
    });
    expect(effectiveAllowedTools(overreaching, "PROSPECT_DEMO")).toEqual([
      "hangup",
    ]);
  });
});

describe("registry", () => {
  test("slugs are unique", () => {
    const slugs = CAPABILITIES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
