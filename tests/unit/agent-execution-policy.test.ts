import { describe, expect, it } from "vitest";
import {
  EXECUTION_MODES,
  EXECUTION_MODE_ACTIVATION_GATES,
  EXECUTION_MODE_POLICIES,
  MANAGED_AUTONOMY_POLICY,
  PRODUCTION_SUPERVISED_POLICY,
  SUPERVISED_PILOT_POLICY,
  executionPolicyChecksum,
  isExecutionMode,
  resolveExecutionPolicy,
} from "@/lib/agentExecution/policy";
import { PROSPECT_DEMO_POLICY } from "@/lib/prospectBootstrap/policy";
import { stableJson } from "@/lib/prospectBootstrap/memory";

const GATED_MODES = EXECUTION_MODES.filter((mode) => EXECUTION_MODE_ACTIVATION_GATES[mode] !== null);

describe("execution mode policy table", () => {
  it("registers exactly one policy per declared mode", () => {
    expect(Object.keys(EXECUTION_MODE_POLICIES).sort()).toEqual([...EXECUTION_MODES].sort());
    expect(Object.keys(EXECUTION_MODE_ACTIVATION_GATES).sort()).toEqual([...EXECUTION_MODES].sort());
  });

  it("gives every policy the same shape, so one checksum mechanism covers all modes", () => {
    const demoKeys = Object.keys(PROSPECT_DEMO_POLICY).sort();
    for (const mode of EXECUTION_MODES) {
      expect(Object.keys(EXECUTION_MODE_POLICIES[mode]).sort()).toEqual(demoKeys);
    }
  });

  it("labels each policy with its own mode", () => {
    for (const mode of EXECUTION_MODES) {
      expect(EXECUTION_MODE_POLICIES[mode].executionMode).toBe(mode);
    }
  });
});

describe("prospect demo lane compatibility", () => {
  // lib/prospectBootstrap/service.ts compares a stored AgentProfile.system_policy_json
  // against PROSPECT_DEMO_POLICY. Registering it here must not alter it.
  it("re-exports the shipped demo policy byte-identically", () => {
    expect(EXECUTION_MODE_POLICIES.PROSPECT_DEMO).toBe(PROSPECT_DEMO_POLICY);
    expect(stableJson(EXECUTION_MODE_POLICIES.PROSPECT_DEMO)).toBe(stableJson(PROSPECT_DEMO_POLICY));
  });

  it("keeps the demo lane ungated and fully closed", () => {
    expect(EXECUTION_MODE_ACTIVATION_GATES.PROSPECT_DEMO).toBeNull();
    expect(PROSPECT_DEMO_POLICY.crmSyncEnabled).toBe(false);
    expect(PROSPECT_DEMO_POLICY.transferEnabled).toBe(false);
    expect(PROSPECT_DEMO_POLICY.allowedTools).toEqual(["hangup"]);
  });
});

describe("resolveExecutionPolicy fails closed", () => {
  it("falls back to the demo policy for unknown input", () => {
    for (const value of ["", "nope", "prospect_demo", null, undefined, 7, {}, []]) {
      expect(resolveExecutionPolicy(value)).toBe(PROSPECT_DEMO_POLICY);
    }
  });

  it("refuses a gated mode when authorization is absent", () => {
    for (const mode of GATED_MODES) {
      expect(resolveExecutionPolicy(mode)).toBe(PROSPECT_DEMO_POLICY);
      expect(resolveExecutionPolicy(mode, {})).toBe(PROSPECT_DEMO_POLICY);
      expect(resolveExecutionPolicy(mode, { activationAuthorized: false })).toBe(PROSPECT_DEMO_POLICY);
    }
  });

  it("requires the authorization flag to be exactly true, not merely truthy", () => {
    for (const mode of GATED_MODES) {
      const policy = resolveExecutionPolicy(mode, { activationAuthorized: "yes" as unknown as boolean });
      expect(policy).toBe(PROSPECT_DEMO_POLICY);
    }
  });

  it("returns the gated policy once authorization is explicit", () => {
    for (const mode of GATED_MODES) {
      expect(resolveExecutionPolicy(mode, { activationAuthorized: true })).toBe(EXECUTION_MODE_POLICIES[mode]);
    }
  });

  it("returns the demo policy for the demo mode regardless of authorization", () => {
    expect(resolveExecutionPolicy("PROSPECT_DEMO")).toBe(PROSPECT_DEMO_POLICY);
    expect(resolveExecutionPolicy("PROSPECT_DEMO", { activationAuthorized: true })).toBe(PROSPECT_DEMO_POLICY);
  });
});

describe("capability boundaries that no tier may cross", () => {
  it("never enables payment or provider memory at any tier", () => {
    for (const mode of EXECUTION_MODES) {
      expect(EXECUTION_MODE_POLICIES[mode].paymentEnabled).toBe(false);
      expect(EXECUTION_MODE_POLICIES[mode].providerMemoryEnabled).toBe(false);
    }
  });

  it("never enables recording without a ratified consent posture", () => {
    for (const mode of EXECUTION_MODES) {
      expect(EXECUTION_MODE_POLICIES[mode].recordingEnabled).toBe(false);
    }
  });

  it("keeps the same uncertainty fallback and prohibited-advice set across tiers", () => {
    for (const mode of EXECUTION_MODES) {
      expect(EXECUTION_MODE_POLICIES[mode].uncertaintyFallback).toBe(PROSPECT_DEMO_POLICY.uncertaintyFallback);
      expect(EXECUTION_MODE_POLICIES[mode].prohibitedAdvice).toEqual(PROSPECT_DEMO_POLICY.prohibitedAdvice);
    }
  });

  it("only permits outbound at managed autonomy", () => {
    expect(SUPERVISED_PILOT_POLICY.outboundEnabled).toBe(false);
    expect(PRODUCTION_SUPERVISED_POLICY.outboundEnabled).toBe(false);
    expect(MANAGED_AUTONOMY_POLICY.outboundEnabled).toBe(true);
  });

  it("grows capability monotonically from pilot to autonomy", () => {
    const ordered = [PROSPECT_DEMO_POLICY, SUPERVISED_PILOT_POLICY, PRODUCTION_SUPERVISED_POLICY, MANAGED_AUTONOMY_POLICY];
    for (let i = 1; i < ordered.length; i += 1) {
      expect(ordered[i].allowedTools.length).toBeGreaterThanOrEqual(ordered[i - 1].allowedTools.length);
      for (const tool of ordered[i - 1].allowedTools) {
        expect(ordered[i].allowedTools).toContain(tool);
      }
    }
  });

  it("declares a disclosure on every tier", () => {
    for (const mode of EXECUTION_MODES) {
      expect(EXECUTION_MODE_POLICIES[mode].requiredDisclosure.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("policy checksums", () => {
  it("is stable across calls and independent of key order", () => {
    const first = executionPolicyChecksum(SUPERVISED_PILOT_POLICY);
    const second = executionPolicyChecksum({ ...SUPERVISED_PILOT_POLICY });
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
  });

  it("distinguishes every mode", () => {
    const sums = EXECUTION_MODES.map((mode) => executionPolicyChecksum(EXECUTION_MODE_POLICIES[mode]));
    expect(new Set(sums).size).toBe(EXECUTION_MODES.length);
  });

  it("changes when a capability changes", () => {
    const tampered = { ...SUPERVISED_PILOT_POLICY, paymentEnabled: true };
    expect(executionPolicyChecksum(tampered)).not.toBe(executionPolicyChecksum(SUPERVISED_PILOT_POLICY));
  });
});

describe("isExecutionMode", () => {
  it("accepts declared modes and rejects everything else", () => {
    for (const mode of EXECUTION_MODES) expect(isExecutionMode(mode)).toBe(true);
    for (const value of ["", "PROSPECT", "supervised_pilot", null, undefined, 0, {}]) {
      expect(isExecutionMode(value)).toBe(false);
    }
  });
});
