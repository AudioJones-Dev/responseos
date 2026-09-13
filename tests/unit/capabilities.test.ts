import { describe, expect, test } from "vitest";
import {
  CAPABILITIES,
  INBOUND_LEAD_QUALIFICATION_CAPABILITY,
  RECEPTIONIST_CAPABILITY,
  capabilityChecksum,
  effectiveAllowedTools,
  readinessGate,
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
    } as CapabilityDescriptor;

    expect(capabilityChecksum(reordered)).toBe(
      capabilityChecksum(RECEPTIONIST_CAPABILITY),
    );
  });

  // Scoped deliberately: the descriptor references the prospect template by
  // version label rather than containing it, so the prompt is pinned by
  // PROSPECT_RECEPTIONIST_TEMPLATE_CHECKSUM, not by this one. See the note in
  // descriptors/receptionist.ts.
  test("changes when any descriptor field changes", () => {
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

  test("readiness gate is derived from the mode, not stored", () => {
    expect(readinessGate(RECEPTIONIST_CAPABILITY)).toBeNull();
    expect(
      readinessGate(
        mutate(RECEPTIONIST_CAPABILITY, {
          minimumExecutionMode: "PRODUCTION_SUPERVISED",
        }),
      ),
    ).toBe("v0.3-live-communications");
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
  // A capability that legitimately wants `schedule` at a gated mode. Used to
  // prove the gate is respected: reading the raw policy table would hand it
  // `schedule` with no authorization at all.
  const scheduling = mutate(RECEPTIONIST_CAPABILITY, {
    slug: "scheduling-capability",
    minimumExecutionMode: "PRODUCTION_SUPERVISED",
    allowedTools: Object.freeze(["hangup", "schedule"]),
  });

  test("a gated mode grants nothing extra without its activation gate", () => {
    expect(effectiveAllowedTools(scheduling, "PRODUCTION_SUPERVISED")).toEqual([
      "hangup",
    ]);
  });

  test("the same mode grants the tool once its named gate is authorized", () => {
    expect(
      effectiveAllowedTools(scheduling, "PRODUCTION_SUPERVISED", {
        authorizedGates: ["v0.3-live-communications"],
      }),
    ).toEqual(["hangup", "schedule"]);
  });

  test("a gate opened for a different mode does not unlock this one", () => {
    expect(
      effectiveAllowedTools(
        mutate(scheduling, { minimumExecutionMode: "MANAGED_AUTONOMY" }),
        "MANAGED_AUTONOMY",
        { authorizedGates: ["v0.3-live-communications"] },
      ),
    ).toEqual(["hangup"]);
  });

  test("a more permissive mode cannot widen a capability's declared set", () => {
    expect(
      effectiveAllowedTools(RECEPTIONIST_CAPABILITY, "MANAGED_AUTONOMY", {
        authorizedGates: ["post-pilot-operator-authorization"],
      }),
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

  // Fail-closed here means "degrade to the demo lane", matching
  // `resolveExecutionPolicy`, which resolves an unrecognised mode to
  // PROSPECT_DEMO rather than throwing. Deliberately not a second, stricter
  // fail-closed rule: two different degraded behaviours would be worse than one
  // shared one, and the demo lane is already the most restrictive policy.
  test("an unrecognised mode grants no more than the demo lane", () => {
    expect(effectiveAllowedTools(RECEPTIONIST_CAPABILITY, "nonsense")).toEqual([
      "hangup",
    ]);
    expect(
      effectiveAllowedTools(INBOUND_LEAD_QUALIFICATION_CAPABILITY, "nonsense"),
    ).toEqual([]);
  });

  test("an unrecognised mode cannot grant a gated tool", () => {
    expect(
      effectiveAllowedTools(
        mutate(RECEPTIONIST_CAPABILITY, {
          allowedTools: Object.freeze(["hangup", "schedule"]),
        }),
        "nonsense",
      ),
    ).toEqual(["hangup"]);
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

describe("descriptor permission surface is deeply immutable", () => {
  // Object.freeze is shallow, so a frozen descriptor aliasing an unfrozen array
  // would share mutable state with its source and let the checksum drift within
  // a single process.
  test("allowedTools cannot be mutated through the descriptor", () => {
    const before = capabilityChecksum(RECEPTIONIST_CAPABILITY);
    expect(Object.isFrozen(RECEPTIONIST_CAPABILITY.allowedTools)).toBe(true);
    expect(() => {
      (RECEPTIONIST_CAPABILITY.allowedTools as string[]).push("schedule");
    }).toThrow();
    expect(capabilityChecksum(RECEPTIONIST_CAPABILITY)).toBe(before);
  });

  test("every registered capability's tool list is frozen", () => {
    for (const capability of CAPABILITIES) {
      expect(Object.isFrozen(capability.allowedTools)).toBe(true);
    }
  });
});

describe("registry", () => {
  test("slugs are unique", () => {
    const slugs = CAPABILITIES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
