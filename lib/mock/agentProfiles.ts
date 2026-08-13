import { MockAgentProfile, type AgentProfile } from "@/types/agentProfile";

const SAFE_FALLBACK =
  "I don't have verified information available for that, but I can note the question for Tyrone or help schedule a conversation with him.";

export const mockAgentProfiles: AgentProfile[] = [
  MockAgentProfile({
    id: "agent_profile_tyrone_recruiter",
    name: "Recruiter Receptionist",
    slug: "recruiter-receptionist",
    profile_type: "recruiter_receptionist",
    is_default: true,
    policy_json: { verified_only: true, unknown_claim_fallback: SAFE_FALLBACK },
  }),
  MockAgentProfile({
    id: "agent_profile_tyrone_consulting",
    name: "Consulting Receptionist",
    slug: "consulting-receptionist",
    profile_type: "consulting_receptionist",
    policy_json: { verified_only: true, unknown_claim_fallback: SAFE_FALLBACK },
  }),
  MockAgentProfile({
    id: "agent_profile_tyrone_professional",
    name: "Professional Assistant",
    slug: "professional-assistant",
    profile_type: "professional_assistant",
    policy_json: { verified_only: true, unknown_claim_fallback: SAFE_FALLBACK },
  }),
  MockAgentProfile({
    id: "agent_profile_tyrone_demo",
    name: "Demo Mode",
    slug: "demo-mode",
    profile_type: "demo_mode",
    policy_json: {
      verified_only: true,
      unknown_claim_fallback: SAFE_FALLBACK,
      disclose_demo_workflow: true,
    },
  }),
];

export function getMockAgentProfiles(): AgentProfile[] {
  return mockAgentProfiles;
}
