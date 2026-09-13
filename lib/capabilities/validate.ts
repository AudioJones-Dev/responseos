import {
  EXECUTION_MODE_ACTIVATION_GATES,
  EXECUTION_MODE_POLICIES,
  isExecutionMode,
  resolveExecutionPolicy,
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
 * The named gate that must be open before this capability may run live, or
 * `null` when it carries none.
 *
 * Derived rather than stored. An earlier draft carried `readinessGate` as a
 * descriptor field, but the validator could only ever accept the value the mode
 * already implies — a field that must equal a derived value *is* a derived
 * value, and storing it invites the two to disagree.
 */
export function readinessGate(descriptor: CapabilityDescriptor): string | null {
  if (!isExecutionMode(descriptor.minimumExecutionMode)) return null;
  return EXECUTION_MODE_ACTIVATION_GATES[descriptor.minimumExecutionMode];
}

/**
 * The effective tool set: the intersection of what the capability declares with
 * what the tenant's *resolved* policy permits. Intersection, never union — a
 * capability must not acquire a tool by being assigned to a more permissive
 * tenant, and an empty declared set stays empty everywhere.
 *
 * Resolution goes through `resolveExecutionPolicy` rather than reading
 * `EXECUTION_MODE_POLICIES` directly, so a gated mode whose activation gate is
 * absent from `authorizedGates` fails closed to the demo policy. Reading the raw
 * table returned `transfer` or `schedule` for a mode nobody had authorized,
 * bypassing the named gates this helper exists to respect. Callers must say
 * *which* gates are open; omitting them grants the demo lane's tools and no
 * more.
 */
export function effectiveAllowedTools(
  descriptor: CapabilityDescriptor,
  mode: unknown,
  options: { authorizedGates?: readonly string[] } = {},
): string[] {
  const policy = resolveExecutionPolicy(mode, options);
  return descriptor.allowedTools.filter((tool) => policy.allowedTools.includes(tool));
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
  //
  // This reads the raw policy table deliberately, unlike `effectiveAllowedTools`
  // above. Publication asks whether a capability is *coherent* — could this mode
  // ever grant these tools once authorized — which is a property of the
  // descriptor, not of any tenant's current authorization. Whether a gate is
  // open is runtime readiness, and the three validation layers stay distinct.
  const modeTools = EXECUTION_MODE_POLICIES[descriptor.minimumExecutionMode].allowedTools;
  for (const tool of descriptor.allowedTools) {
    if (!modeTools.includes(tool)) violations.push(`tool_not_permitted_by_mode:${tool}`);
  }

  return { valid: violations.length === 0, violations: Object.freeze(violations) };
}
