import type { AgentProfile } from "@/types/agentProfile";

// Stable anchors mirror prisma/seed.ts so parity tests stay deterministic.
const PROFILE_CREATED_AT = "2026-08-03T12:00:00.000Z";

export const mockAgentProfiles: AgentProfile[] = [
  {
    id: "agent_tyrone_consulting",
    account_id: "org_tyrone_1",
    name: "Consulting Receptionist",
    slug: "consulting-receptionist",
    type: "consulting_receptionist",
    enabled: true,
    is_default: false,
    system_policy_json: {
      allowedAppointmentTypes: ["consulting_discovery"],
      allowedAssetTypes: ["portfolio", "case_study"],
      compensationDisclosure: "escalate",
      referencesDisclosure: "escalate",
      knowledgeFallback: "verified_only",
    },
    metadata_json: {
      description:
        "Qualifies consulting and advisory inquiries, captures the operational problem, and routes discovery calls.",
    },
    created_at: PROFILE_CREATED_AT,
    updated_at: PROFILE_CREATED_AT,
  },
  {
    id: "agent_tyrone_demo",
    account_id: "org_tyrone_1",
    name: "Demo Mode",
    slug: "demo-mode",
    type: "demo_mode",
    enabled: true,
    is_default: false,
    system_policy_json: {
      allowedAppointmentTypes: ["demo"],
      allowedAssetTypes: [],
      compensationDisclosure: "escalate",
      referencesDisclosure: "escalate",
      knowledgeFallback: "verified_only",
    },
    metadata_json: {
      description:
        "Narrates the ResponseOS workflow being exercised during a live demonstration while staying grounded in this account's real records.",
    },
    created_at: PROFILE_CREATED_AT,
    updated_at: PROFILE_CREATED_AT,
  },
  {
    id: "agent_tyrone_professional",
    account_id: "org_tyrone_1",
    name: "Professional Assistant",
    slug: "professional-assistant",
    type: "professional_assistant",
    enabled: true,
    is_default: false,
    system_policy_json: {
      allowedAppointmentTypes: ["professional_intro"],
      allowedAssetTypes: ["portfolio", "linkedin"],
      compensationDisclosure: "escalate",
      referencesDisclosure: "escalate",
      knowledgeFallback: "verified_only",
    },
    metadata_json: {
      description:
        "General professional front door — who Tyrone is, what he works on, and how to reach him.",
    },
    created_at: PROFILE_CREATED_AT,
    updated_at: PROFILE_CREATED_AT,
  },
  {
    id: "agent_tyrone_recruiter",
    account_id: "org_tyrone_1",
    name: "Recruiter Receptionist",
    slug: "recruiter-receptionist",
    type: "recruiter_receptionist",
    enabled: true,
    is_default: true,
    system_policy_json: {
      allowedAppointmentTypes: ["recruiter_screen", "hiring_manager_interview"],
      allowedAssetTypes: ["resume", "portfolio", "linkedin", "github"],
      compensationDisclosure: "escalate",
      referencesDisclosure: "escalate",
      knowledgeFallback: "verified_only",
    },
    metadata_json: {
      description:
        "Answers verified questions about Tyrone Nelms' professional experience, projects and capabilities, captures recruiting opportunities, and helps schedule interviews.",
    },
    created_at: PROFILE_CREATED_AT,
    updated_at: PROFILE_CREATED_AT,
  },
];

export function getMockAgentProfiles(): AgentProfile[] {
  return mockAgentProfiles;
}
