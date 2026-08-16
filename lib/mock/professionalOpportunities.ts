import type { ProfessionalOpportunity } from "@/types/professionalOpportunity";

// Stable anchors mirror prisma/seed.ts so parity tests stay deterministic.
const OPPORTUNITY_CREATED_AT = "2026-08-03T14:22:00.000Z";

export const mockProfessionalOpportunities: ProfessionalOpportunity[] = [
  {
    id: "popp_tyrone_1",
    account_id: "org_tyrone_1",
    contact_id: "contact_tyrone_recruiter_1",
    agent_profile_id: "agent_tyrone_recruiter",
    opportunity_type: "employment",
    company: "Northwind Systems",
    role_title: "Business Systems Analyst",
    recruiter_name: "Jane Smith",
    recruiter_email: "jane.smith@northwind.example",
    recruiter_phone: "+15555550701",
    interest_level: "high",
    status: "scheduled",
    source_call_id: "call_tyrone_1",
    source_conversation_id: "conv_tyrone_1",
    appointment_id: "booking_tyrone_1",
    questions_asked: [
      "business systems experience",
      "AI implementation experience",
      "stakeholder management",
    ],
    summary:
      "Recruiter screen requested for a Business Systems Analyst role. Career questions were not answered from memory — no verified Career OS record is loaded, so each one was captured for follow-up.",
    recommended_preparation: [
      "review the company platform",
      "prepare an operations case study",
      "prepare a business systems transformation example",
    ],
    next_action: "prepare for recruiter interview",
    created_at: OPPORTUNITY_CREATED_AT,
    updated_at: OPPORTUNITY_CREATED_AT,
  },
];

export function getMockProfessionalOpportunities(): ProfessionalOpportunity[] {
  return mockProfessionalOpportunities;
}
