import { PROSPECT_DEMO_POLICY } from "@/lib/prospectBootstrap/policy";

/**
 * Per-tenant supervision tiers (ADR-0051).
 *
 * These are *policy* declarations, not activation. A mode describes what a
 * tenant's agent is permitted to do once its gate is open; it never opens the
 * gate. Live provider behaviour stays governed by the existing environment
 * flags and the v0.3/v0.4 roadmap gates, exactly as before.
 *
 * `PROSPECT_DEMO` is the shipped prospect-demo lane and is re-exported here
 * byte-identically — `lib/prospectBootstrap/service.ts` compares a stored
 * `AgentProfile.system_policy_json` against that frozen object, so its shape
 * and values must not drift.
 */
export const EXECUTION_MODES = [
  "PROSPECT_DEMO",
  "SUPERVISED_PILOT",
  "PRODUCTION_SUPERVISED",
  "MANAGED_AUTONOMY",
] as const;

export type ExecutionMode = (typeof EXECUTION_MODES)[number];

export interface ExecutionPolicy {
  readonly executionMode: string;
  readonly templateVersion: string;
  readonly inboundOnly: boolean;
  readonly recordingEnabled: boolean;
  readonly crmSyncEnabled: boolean;
  readonly schedulingEnabled: boolean;
  readonly paymentEnabled: boolean;
  readonly outboundEnabled: boolean;
  readonly transferEnabled: boolean;
  readonly providerMemoryEnabled: boolean;
  readonly allowedTools: readonly string[];
  readonly requiredDisclosure: string;
  readonly uncertaintyFallback: string;
  readonly prohibitedAdvice: readonly string[];
}

const SHARED_UNCERTAINTY_FALLBACK = PROSPECT_DEMO_POLICY.uncertaintyFallback;
const SHARED_PROHIBITED_ADVICE = PROSPECT_DEMO_POLICY.prohibitedAdvice;

/**
 * Supervised pilot: a real client answering real inbound calls with a human
 * owner watching. Adds CRM write intent and human transfer over the demo lane.
 * Still inbound-only, still no payment, scheduling, outbound, or provider
 * memory.
 */
export const SUPERVISED_PILOT_POLICY: ExecutionPolicy = Object.freeze({
  executionMode: "SUPERVISED_PILOT",
  templateVersion: PROSPECT_DEMO_POLICY.templateVersion,
  inboundOnly: true,
  recordingEnabled: false,
  crmSyncEnabled: true,
  schedulingEnabled: false,
  paymentEnabled: false,
  outboundEnabled: false,
  transferEnabled: true,
  providerMemoryEnabled: false,
  allowedTools: Object.freeze(["hangup", "transfer"]),
  requiredDisclosure:
    "This call is being handled by an automated assistant. This call may be transcribed. I can connect you with a person at any time.",
  uncertaintyFallback: SHARED_UNCERTAINTY_FALLBACK,
  prohibitedAdvice: SHARED_PROHIBITED_ADVICE,
});

/**
 * Production-supervised: normal traffic handled by the agent, exceptions
 * routed to humans, QA sampled. Adds scheduling. Payment and outbound remain
 * closed at every tier.
 */
export const PRODUCTION_SUPERVISED_POLICY: ExecutionPolicy = Object.freeze({
  executionMode: "PRODUCTION_SUPERVISED",
  templateVersion: PROSPECT_DEMO_POLICY.templateVersion,
  inboundOnly: true,
  recordingEnabled: false,
  crmSyncEnabled: true,
  schedulingEnabled: true,
  paymentEnabled: false,
  outboundEnabled: false,
  transferEnabled: true,
  providerMemoryEnabled: false,
  allowedTools: Object.freeze(["hangup", "transfer", "schedule"]),
  requiredDisclosure: SUPERVISED_PILOT_POLICY.requiredDisclosure,
  uncertaintyFallback: SHARED_UNCERTAINTY_FALLBACK,
  prohibitedAdvice: SHARED_PROHIBITED_ADVICE,
});

/**
 * Managed autonomy: the most permissive tier the roadmap contemplates. It adds
 * outbound recovery only. Payment and provider memory stay closed because no
 * ratified decision authorises either.
 */
export const MANAGED_AUTONOMY_POLICY: ExecutionPolicy = Object.freeze({
  executionMode: "MANAGED_AUTONOMY",
  templateVersion: PROSPECT_DEMO_POLICY.templateVersion,
  inboundOnly: false,
  recordingEnabled: false,
  crmSyncEnabled: true,
  schedulingEnabled: true,
  paymentEnabled: false,
  outboundEnabled: true,
  transferEnabled: true,
  providerMemoryEnabled: false,
  allowedTools: Object.freeze(["hangup", "transfer", "schedule"]),
  requiredDisclosure: SUPERVISED_PILOT_POLICY.requiredDisclosure,
  uncertaintyFallback: SHARED_UNCERTAINTY_FALLBACK,
  prohibitedAdvice: SHARED_PROHIBITED_ADVICE,
});

export const EXECUTION_MODE_POLICIES: Readonly<Record<ExecutionMode, ExecutionPolicy>> = Object.freeze({
  PROSPECT_DEMO: PROSPECT_DEMO_POLICY,
  SUPERVISED_PILOT: SUPERVISED_PILOT_POLICY,
  PRODUCTION_SUPERVISED: PRODUCTION_SUPERVISED_POLICY,
  MANAGED_AUTONOMY: MANAGED_AUTONOMY_POLICY,
});

/**
 * The separate gate each mode still requires before it may be resolved.
 * `null` means the mode carries no additional gate — true only for the shipped
 * prospect-demo lane. Kept outside the policy objects deliberately: adding a
 * key to `PROSPECT_DEMO_POLICY` would break the stored-policy comparison in
 * `lib/prospectBootstrap/service.ts`.
 */
export const EXECUTION_MODE_ACTIVATION_GATES: Readonly<Record<ExecutionMode, string | null>> = Object.freeze({
  PROSPECT_DEMO: null,
  SUPERVISED_PILOT: "v0.3-live-communications",
  PRODUCTION_SUPERVISED: "v0.3-live-communications",
  MANAGED_AUTONOMY: "post-pilot-operator-authorization",
});

export function isExecutionMode(value: unknown): value is ExecutionMode {
  return typeof value === "string" && (EXECUTION_MODES as readonly string[]).includes(value);
}

/**
 * Resolve the policy for a mode, failing closed.
 *
 * Authorisation is bound to the *specific* gate the mode requires, named in
 * `EXECUTION_MODE_ACTIVATION_GATES`. A single "authorized" boolean would let an
 * approval issued for one gate unlock a mode behind a different one — opening
 * `v0.3-live-communications` would also grant `MANAGED_AUTONOMY`, whose gate is
 * `post-pilot-operator-authorization`. The caller must therefore say *which*
 * gates are open, and only modes behind those gates resolve.
 *
 * An unrecognised mode, or a gated mode whose gate is not in `authorizedGates`,
 * resolves to the most restrictive policy rather than throwing — a caller that
 * forgets to pass authorisation degrades to the demo lane instead of silently
 * granting a capability.
 */
export function resolveExecutionPolicy(
  mode: unknown,
  options: { authorizedGates?: readonly string[] } = {},
): ExecutionPolicy {
  if (!isExecutionMode(mode)) return PROSPECT_DEMO_POLICY;
  const requiredGate = EXECUTION_MODE_ACTIVATION_GATES[mode];
  if (requiredGate === null) return EXECUTION_MODE_POLICIES[mode];
  const authorizedGates = options.authorizedGates;
  if (!Array.isArray(authorizedGates)) return PROSPECT_DEMO_POLICY;
  if (!authorizedGates.some((gate) => gate === requiredGate)) return PROSPECT_DEMO_POLICY;
  return EXECUTION_MODE_POLICIES[mode];
}
