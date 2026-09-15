import type { LeadQualificationInput } from "./leadQualificationScore";

export type QualificationTimeline = "same_day" | "this_week" | "this_month" | "unknown";

/**
 * Structured qualification facts as a provider adapter extracts them — the
 * `LeadQualification` columns, not the provider's opinion of the lead. The
 * provider's own `score` is deliberately absent: ResponseOS computes the score
 * from facts (ADR-0058; capability `inbound-lead-qualification` objective).
 */
export interface QualificationFacts {
  serviceAreaMatch: boolean;
  timeline: QualificationTimeline;
  serviceNeeded: string | null;
  decisionMaker: boolean | null;
}

/**
 * The one business rule this module introduces. Callers report *when* they
 * want the work done; the scorer weights *urgency*. `unknown` falls to `low`
 * because an unstated timeline is not evidence of urgency, and the scorer
 * treats urgency as mandatory rather than absent.
 */
export const URGENCY_FROM_TIMELINE: Readonly<
  Record<QualificationTimeline, LeadQualificationInput["urgency"]>
> = Object.freeze({
  same_day: "urgent",
  this_week: "high",
  this_month: "medium",
  unknown: "low",
});

export function qualificationInputFromFacts(facts: QualificationFacts): LeadQualificationInput {
  return {
    serviceAreaMatch: facts.serviceAreaMatch,
    urgency: URGENCY_FROM_TIMELINE[facts.timeline],
    serviceRequested: facts.serviceNeeded ?? undefined,
    decisionMaker: facts.decisionMaker ?? undefined,
  };
}
