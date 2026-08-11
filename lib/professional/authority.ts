import type { ProfessionalKnowledgeCategory } from "@/lib/providers/professionalKnowledge";

/**
 * What the receptionist is permitted to do with a claim category.
 *
 * - `answer`      — may be spoken, but only from a verified record.
 * - `tool_lookup` — must be resolved against a live tool (calendar),
 *                   never from memory.
 * - `escalate`    — hand to the account owner; the caller is told so.
 * - `refuse`      — decline and offer the owner instead.
 * - `unavailable` — nothing is known; use the fallback line.
 */
export type ClaimAuthority =
  | "answer"
  | "tool_lookup"
  | "escalate"
  | "refuse"
  | "unavailable";

/**
 * Claim-authority policy (ADR-0046). Categories that could commit the
 * account owner to terms — compensation, rates, references — escalate
 * by default rather than being answered, and disclosure policy on an
 * agent profile may only make them stricter, never looser
 * (lib/professional/policy.ts).
 */
export const CLAIM_AUTHORITY: Record<
  ProfessionalKnowledgeCategory,
  ClaimAuthority
> = {
  profile: "answer",
  work_history: "answer",
  skills: "answer",
  projects: "answer",
  case_studies: "answer",
  education: "answer",
  certifications: "answer",
  employment_preferences: "answer",
  contract_availability: "answer",
  interview_availability: "tool_lookup",
  compensation: "escalate",
  consulting_rates: "escalate",
  references: "escalate",
  personal: "refuse",
  unknown: "unavailable",
};

/**
 * Categories that always reach a human, whatever a caller asks and
 * whatever an agent profile is configured to allow (§22 human-in-the-
 * loop rules).
 */
export const ALWAYS_ESCALATE: ReadonlySet<ProfessionalKnowledgeCategory> =
  new Set(["compensation", "consulting_rates", "references"]);

/**
 * The single line used whenever nothing verified is available. Takes
 * the owner name so the core product stays tenant-agnostic — no demo
 * identity is baked into shared logic.
 */
export function unverifiedFallback(ownerName: string): string {
  return `I don't have verified information available for that, but I can note the question for ${ownerName} or help schedule a conversation with ${ownerName}.`;
}

export function refusalMessage(ownerName: string): string {
  return `That's not something I can share. I can note the question for ${ownerName} or help schedule a conversation instead.`;
}

export function escalationMessage(ownerName: string): string {
  return `That one is ${ownerName}'s to answer directly. I've noted it, and I can help schedule a conversation.`;
}
