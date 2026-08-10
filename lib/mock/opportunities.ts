import { MockOpportunity, type Opportunity } from "@/types/opportunity";

export const mockOpportunities: Opportunity[] = [
  MockOpportunity({
    id: "opportunity_tyrone_censys_bsa",
    contact_id: "contact_tyrone_demo_recruiter",
    appointment_id: "appointment_tyrone_recruiter_screen",
    opportunity_type: "employment",
    status: "scheduled",
    interest_level: "high",
    summary:
      "Synthetic demo recruiter inquiry about systems analysis, AI automation, and stakeholder management.",
    details_json: {
      fixture: true,
      company: "Censys",
      roleTitle: "Business Systems Analyst",
      recruiterName: "Jane Smith",
      recruiterEmail: "jane.smith@example.com",
      source: "demo_fixture",
    },
    questions_asked: [
      "systems analysis experience",
      "AI automation experience",
      "stakeholder management",
    ],
    recommended_preparation: [
      "Review the role description",
      "Prepare approved systems-analysis examples",
    ],
    next_action: "Prepare for recruiter screening",
  }),
];

export function getMockOpportunities(): Opportunity[] {
  return mockOpportunities;
}
