import {
  EXECUTION_MODE_ACTIVATION_GATES,
  EXECUTION_MODE_POLICIES,
  isExecutionMode,
} from "@/lib/agentExecution/policy";
import type { CapabilityDescriptor } from "./contract";

/**
 * Governance validation (ADR-0054 decision 5).
 *
 * Answers one question: *is this capability allowed to publish?* It is separate
 * from structural validity, which the type system and `Object.freeze` already
 * provide for a Git-authored module, and from runtime readiness, which
 * `evaluateOperatingConfiguration` already reports per tenant. The three stay
 * distinct: a capability can be governance-valid and still not runtime-ready.
 *
 * No Zod schema here on purpose. `AGENTS.md` validates at boundaries, and an
 * internal frozen module is not a boundary. Zod earns its place when a real one
 * appears — a database draft, or CLI input.
 */

export interface CapabilityGovernanceResult {
  readonly valid: boolean;
  readonly violations: readonly string[];
}

/**
 * The effective tool set: the intersection of what the capability declares with
 * what the mode permits. Intersection, never union — a capability must not be
 * able to acquire a tool by being assigned to a more permissive tenant, and an
 * empty declared set must stay empty everywhere.
 */
export function effectiveAllowedTools(
  descriptor: CapabilityDescriptor,
  mode: unknown,
): string[] {
  if (!isExecutionMode(mode)) return [];
  const modeTools = EXECUTION_MODE_POLICIES[mode].allowedTools;
  return descriptor.allowedTools.filter((tool) => modeTools.includes(tool));
}

export function validateCapabilityGovernance(
  descriptor: CapabilityDescriptor,
): CapabilityGovernanceResult {
  const violations: string[] = [];

  if (descriptor.slug.trim().length === 0) violations.push("slug_missing");
  if (descriptor.name.trim().length === 0) violations.push("name_missing");
  if (descriptor.versionLabel.trim().length === 0) violations.push("version_label_missing");
  if (descriptor.objective.trim().length === 0) violations.push("objective_missing");
  if (descriptor.triggers.length === 0) violations.push("trigger_missing");
  if (descriptor.producesRecords.length === 0) violations.push("output_contract_missing");

  if (!isExecutionMode(descriptor.minimumExecutionMode)) {
    violations.push("execution_mode_unrecognised");
    return { valid: false, violations: Object.freeze(violations) };
  }

  // The load-bearing check. A capability may not declare a tool its minimum
  // mode withholds, because the intersection would silently drop it and the
  // descriptor would then promise a capability it never has.
  const modeTools = EXECUTION_MODE_POLICIES[descriptor.minimumExecutionMode].allowedTools;
  for (const tool of descriptor.allowedTools) {
    if (!modeTools.includes(tool)) violations.push(`tool_not_permitted_by_mode:${tool}`);
  }

  // The declared gate must be the one the mode actually requires. A descriptor
  // naming a different gate — or none where one exists — would misreport what
  // has to be open before it can run live.
  const requiredGate = EXECUTION_MODE_ACTIVATION_GATES[descriptor.minimumExecutionMode];
  if (descriptor.readinessGate !== requiredGate) {
    violations.push(`readiness_gate_mismatch:expected_${requiredGate ?? "null"}`);
  }

  return { valid: violations.length === 0, violations: Object.freeze(violations) };
}
