import type { BusinessMemorySnapshot } from "@/lib/prospectBootstrap/contracts";
import { PROSPECT_DEMO_POLICY } from "@/lib/prospectBootstrap/policy";
import { stableJson } from "@/lib/prospectBootstrap/memory";
import {
  EXECUTION_MODE_POLICIES,
  isExecutionMode,
  resolveExecutionPolicy,
  type ExecutionMode,
  type ExecutionPolicy,
} from "./policy";

/** Resolves an authorized mode without enabling recording from tenant configuration. */

export type TenantPolicyDegradation =
  | "policy_missing"
  | "policy_checksum_mismatch"
  | "gate_not_authorized";

export interface ResolvedTenantPolicy {
  /** The mode the policy actually grants. */
  mode: ExecutionMode;
  /** The mode the stored profile declared, when it was recognisable. */
  declaredMode: ExecutionMode | null;
  policy: ExecutionPolicy;
  recordingSource: "policy_default" | "tenant_consent_configuration";
  degraded: TenantPolicyDegradation | null;
}

/**
 * Gates authorised for this deployment lane, as a comma-separated environment
 * value. Absent means no gate is open, which is the safe reading: every gated
 * mode then resolves to the demo lane.
 */
export function authorizedExecutionGates(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string[] {
  return (env.RESPONSEOS_AUTHORIZED_EXECUTION_GATES ?? "")
    .split(",")
    .map((gate) => gate.trim())
    .filter((gate) => gate.length > 0);
}

export function executionModeFromProfilePolicy(policyJson: unknown): ExecutionMode | null {
  if (!policyJson || typeof policyJson !== "object" || Array.isArray(policyJson)) return null;
  const mode = (policyJson as Record<string, unknown>).executionMode;
  if (!isExecutionMode(mode)) return null;
  return stableJson(policyJson) === stableJson(EXECUTION_MODE_POLICIES[mode]) ? mode : null;
}

function demoResult(
  declaredMode: ExecutionMode | null,
  degraded: TenantPolicyDegradation,
): ResolvedTenantPolicy {
  return Object.freeze({
    mode: "PROSPECT_DEMO" as const,
    declaredMode,
    policy: PROSPECT_DEMO_POLICY,
    recordingSource: "policy_default" as const,
    degraded,
  });
}

export function resolveTenantExecutionPolicy(params: {
  profilePolicy: unknown;
  memory?: BusinessMemorySnapshot | null;
  authorizedGates?: readonly string[];
}): ResolvedTenantPolicy {
  const declaredMode = executionModeFromProfilePolicy(params.profilePolicy);
  if (!declaredMode) {
    const declared = (params.profilePolicy as { executionMode?: unknown } | null)?.executionMode;
    return demoResult(
      isExecutionMode(declared) ? declared : null,
      isExecutionMode(declared) ? "policy_checksum_mismatch" : "policy_missing",
    );
  }

  const policy = resolveExecutionPolicy(declaredMode, { authorizedGates: params.authorizedGates });
  if (policy.executionMode !== declaredMode) return demoResult(declaredMode, "gate_not_authorized");


  return Object.freeze({
    mode: declaredMode,
    declaredMode,
    policy,
    recordingSource: "policy_default" as const,
    degraded: null,
  });
}
