import { ISODate, UUID, newId, nowIso } from "./common";

export type QualificationTimeline =
  | "same_day"
  | "this_week"
  | "this_month"
  | "unknown";

export type QualificationStatus =
  | "qualified"
  | "maybe"
  | "unqualified"
  | "spam";

export interface LeadQualification {
  id: UUID;
  lead_event_id: UUID;
  service_needed?: string;
  service_area_match: boolean;
  budget_range?: string;
  timeline?: QualificationTimeline;
  property_type?: string;
  decision_maker?: boolean;
  qualification_score: number;
  qualification_status: QualificationStatus;
  disqualification_reason?: string;
  created_at: ISODate;
}

export function MockLeadQualification(
  overrides: Partial<LeadQualification> = {},
): LeadQualification {
  return {
    id: newId(),
    lead_event_id: "lead_mock_1",
    service_needed: "AC repair",
    service_area_match: true,
    budget_range: "$300-$1,000",
    timeline: "this_week",
    property_type: "single_family",
    decision_maker: true,
    qualification_score: 78,
    qualification_status: "qualified",
    disqualification_reason: undefined,
    created_at: nowIso(),
    ...overrides,
  };
}
