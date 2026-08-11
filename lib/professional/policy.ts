import type { AgentProfile, AgentProfileType } from "@/types/agentProfile";
import type { ProfessionalAssetType } from "@/lib/providers/professionalKnowledge";

export type ProfessionalAppointmentType =
  | "recruiter_screen"
  | "hiring_manager_interview"
  | "consulting_discovery"
  | "professional_intro"
  | "demo";

const APPOINTMENT_TYPES: ProfessionalAppointmentType[] = [
  "recruiter_screen",
  "hiring_manager_interview",
  "consulting_discovery",
  "professional_intro",
  "demo",
];

const ASSET_TYPES: ProfessionalAssetType[] = [
  "resume",
  "portfolio",
  "linkedin",
  "github",
  "case_study",
];

/**
 * Per-profile disclosure and capability policy, stored in
 * `AgentProfile.system_policy_json`. It can only narrow what the claim-
 * authority matrix already permits — `escalate` categories can be made
 * `refuse`, never `answer`.
 */
export interface AgentProfilePolicy {
  allowedAppointmentTypes: ProfessionalAppointmentType[];
  allowedAssetTypes: ProfessionalAssetType[];
  compensationDisclosure: "escalate" | "refuse";
  referencesDisclosure: "escalate" | "refuse";
  /** Only verified records may be spoken. No looser mode exists. */
  knowledgeFallback: "verified_only";
}

export const DEFAULT_AGENT_PROFILE_POLICY: AgentProfilePolicy = {
  allowedAppointmentTypes: ["professional_intro"],
  allowedAssetTypes: [],
  compensationDisclosure: "escalate",
  referencesDisclosure: "escalate",
  knowledgeFallback: "verified_only",
};

function readStringArray<T extends string>(
  value: unknown,
  allowed: T[],
): T[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const filtered = value.filter((entry): entry is T =>
    allowed.includes(entry as T),
  );
  return filtered.length > 0 ? filtered : [];
}

function readDisclosure(value: unknown): "escalate" | "refuse" | undefined {
  return value === "escalate" || value === "refuse" ? value : undefined;
}

/**
 * Normalizes stored JSON into a policy. Anything unrecognized falls
 * back to the strict default — a malformed policy must never widen
 * what the receptionist may say.
 */
export function parseAgentProfilePolicy(raw: unknown): AgentProfilePolicy {
  if (!raw || typeof raw !== "object") return DEFAULT_AGENT_PROFILE_POLICY;
  const record = raw as Record<string, unknown>;

  return {
    allowedAppointmentTypes:
      readStringArray(record.allowedAppointmentTypes, APPOINTMENT_TYPES) ??
      DEFAULT_AGENT_PROFILE_POLICY.allowedAppointmentTypes,
    allowedAssetTypes:
      readStringArray(record.allowedAssetTypes, ASSET_TYPES) ??
      DEFAULT_AGENT_PROFILE_POLICY.allowedAssetTypes,
    compensationDisclosure:
      readDisclosure(record.compensationDisclosure) ??
      DEFAULT_AGENT_PROFILE_POLICY.compensationDisclosure,
    referencesDisclosure:
      readDisclosure(record.referencesDisclosure) ??
      DEFAULT_AGENT_PROFILE_POLICY.referencesDisclosure,
    knowledgeFallback: "verified_only",
  };
}

/**
 * Picks the profile that answers: the requested type when it is
 * enabled, otherwise the account's default, otherwise the first
 * enabled profile. Disabled profiles are never selected.
 */
export function resolveAgentProfile(
  profiles: AgentProfile[],
  requestedType?: AgentProfileType,
): AgentProfile | null {
  const enabled = profiles.filter((profile) => profile.enabled);
  if (enabled.length === 0) return null;
  if (requestedType) {
    const match = enabled.find((profile) => profile.type === requestedType);
    if (match) return match;
  }
  return enabled.find((profile) => profile.is_default) ?? enabled[0];
}
