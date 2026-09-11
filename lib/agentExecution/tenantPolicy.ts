import type { BusinessMemorySnapshot } from "@/lib/prospectBootstrap/contracts";
import { PROSPECT_DEMO_POLICY } from "@/lib/prospectBootstrap/policy";
import { stableJson } from "@/lib/prospectBootstrap/memory";
import { readOperatingConfigurationValue } from "./operatingConfiguration";
import {
  EXECUTION_MODE_POLICIES,
  isExecutionMode,
  resolveExecutionPolicy,
  type ExecutionMode,
  type ExecutionPolicy,
} from "./policy";

/**
 * Resolves the policy a tenant's agent actually runs under (ADR-0051 as
 * amended, ADR-0052).
 *
 * Three inputs, each able only to restrict:
 *   1. the mode declared on `AgentProfile.system_policy_json`, which must be a
 *      byte-identical copy of the mode's entry in `EXECUTION_MODE_POLICIES`;
 *   2. the activation gates the deployment lane authorises;
 *   3. the tenant's approved consent configuration, which is the only thing
 *      that can turn recording on.
 *
 * Anything unrecognised, unauthorised, or malformed degrades to the demo lane
 * rather than throwing, so a misconfiguration silences capability instead of
 * granting it.
 */

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

  // Recording is off in every entry of the policy table and stays off unless
  // this tenant's approved consent configuration turns it on. The demo lane can
  // never turn it on, whatever its snapshot says: a prospect demo is bounded to
  // publicly sourced facts and has no consent posture of its own (ADR-0048).
  const consent =
    declaredMode === "PROSPECT_DEMO"
      ? null
      : readOperatingConfigurationValue(params.memory, "policy.consent");
  if (consent?.recording.enabled === true) {
    return Object.freeze({
      mode: declaredMode,
      declaredMode,
      policy: Object.freeze({
        ...policy,
        recordingEnabled: true,
        requiredDisclosure: consent.recording.disclosure,
      }),
      recordingSource: "tenant_consent_configuration" as const,
      degraded: null,
    });
  }

  return Object.freeze({
    mode: declaredMode,
    declaredMode,
    policy,
    recordingSource: "policy_default" as const,
    degraded: null,
  });
}
