/**
 * Deterministic professional-knowledge fixture for the ResponseOS
 * internal demo tenant (ADR-0046).
 *
 * ⚠️ EVERY CAREER CLAIM BELOW IS AN UNVERIFIED PLACEHOLDER.
 *
 * Career truth lives in Career OS, not in ResponseOS. Until a
 * `CareerOsProfessionalKnowledgeProvider` is wired, this fixture stands
 * in for it — and it deliberately ships work history, projects, skills,
 * education, and certifications with `verified: false` so the
 * receptionist refuses to speak them as fact and answers with the
 * fallback line instead (lib/professional/authority.ts).
 *
 * That is the safe default, not an oversight: fabricating an employer,
 * a date, a degree, or a certification is prohibited (AGENTS.md status
 * rules; doctrine §20). Records flip to `verified: true` only when the
 * account owner supplies canonical content or the Career OS adapter
 * lands.
 *
 * What IS verified here is the content the account owner controls
 * without making a career claim: the display name, the assistant's own
 * description, availability policy, meeting durations, and the approved
 * public-asset list.
 *
 * Placeholder URLs use `.example` TLDs, matching the seed's fake-only
 * rule. Swap them for the real public assets when the tenant goes live.
 */

import type {
  ApprovedProfessionalAsset,
  AvailabilityPolicy,
  ExperienceRecord,
  ProfessionalKnowledgeResult,
  ProfessionalProfile,
  ProjectRecord,
  SkillRecord,
} from "./types"

/** Account id of the seeded internal demo tenant (prisma/seed.ts). */
export const INTERNAL_DEMO_ACCOUNT_ID = "org_tyrone_1"

const CAREER_OS_SOURCE = "career_os:placeholder"
const ACCOUNT_CONFIG_SOURCE = "responseos:account_config"

export const demoProfile: ProfessionalProfile = {
  accountId: INTERNAL_DEMO_ACCOUNT_ID,
  ownerName: "Tyrone Nelms",
  headline: "AI professional assistant for Tyrone Nelms",
  summary:
    "Answers verified questions about Tyrone Nelms' professional experience, projects and capabilities, captures recruiting opportunities, and helps schedule interviews.",
  location: "United States",
  verified: true,
}

export const demoExperience: ExperienceRecord[] = [
  {
    id: "exp_placeholder_1",
    company: "PLACEHOLDER — pending verified Career OS record",
    title: "PLACEHOLDER — pending verified Career OS record",
    startDate: "0000-00",
    summary:
      "Placeholder work-history slot. No employer, title, or date is asserted until Career OS supplies the canonical record.",
    verified: false,
  },
]

export const demoProjects: ProjectRecord[] = [
  {
    id: "proj_placeholder_1",
    name: "PLACEHOLDER — pending verified project record",
    summary:
      "Placeholder project slot. Nothing here is presented to a caller until it is verified.",
    skills: [],
    public: false,
    verified: false,
  },
]

export const demoSkills: SkillRecord[] = [
  {
    id: "skill_placeholder_1",
    name: "PLACEHOLDER — pending verified skill record",
    category: "unclassified",
    verified: false,
  },
]

export const demoAvailabilityPolicy: AvailabilityPolicy = {
  accountId: INTERNAL_DEMO_ACCOUNT_ID,
  openToEmployment: true,
  openToConsulting: true,
  employmentTypes: ["full_time", "contract"],
  remotePreference: "remote_or_hybrid",
  meetingDurationsMinutes: [15, 30, 45],
}

export const demoApprovedAssets: ApprovedProfessionalAsset[] = [
  {
    id: "asset_site_1",
    label: "Personal site",
    type: "portfolio",
    url: "https://tyronenelms.example",
    public: true,
  },
  {
    id: "asset_resume_1",
    label: "Resume",
    type: "resume",
    url: "https://tyronenelms.example/resume",
    public: true,
  },
  {
    id: "asset_private_case_study_1",
    label: "Unpublished case study",
    type: "case_study",
    url: "https://tyronenelms.example/private/case-study",
    public: false,
  },
]

/**
 * Searchable knowledge records. Verified entries are answerable;
 * unverified entries exist so the grounding path is exercised and so
 * the operator can see exactly which claims are still unsourced.
 */
export const demoKnowledgeRecords: ProfessionalKnowledgeResult[] = [
  {
    id: "know_profile_1",
    category: "profile",
    title: "Who the assistant represents",
    body: `${demoProfile.ownerName} — ${demoProfile.summary}`,
    sourceId: ACCOUNT_CONFIG_SOURCE,
    verified: true,
    keywords: ["who", "about", "introduce", "assistant", "represent"],
  },
  {
    id: "know_availability_1",
    category: "contract_availability",
    title: "Engagement availability",
    body: "Open to full-time and contract conversations, remote or hybrid. Interview times are confirmed against the calendar, not quoted from memory.",
    sourceId: ACCOUNT_CONFIG_SOURCE,
    verified: true,
    keywords: ["available", "availability", "open to", "contract", "full time", "remote"],
  },
  {
    id: "know_assets_1",
    category: "projects",
    title: "Approved public assets",
    body: "Resume and personal site can be shared on request. Private repositories and unpublished case studies are not shared.",
    sourceId: ACCOUNT_CONFIG_SOURCE,
    verified: true,
    keywords: ["resume", "cv", "portfolio", "site", "website", "link"],
  },
  {
    id: "know_experience_1",
    category: "work_history",
    title: "Work history",
    body: "PLACEHOLDER — no verified work-history record is loaded for this tenant.",
    sourceId: CAREER_OS_SOURCE,
    verified: false,
    keywords: ["experience", "work history", "worked", "employer", "background", "career"],
  },
  {
    id: "know_skills_1",
    category: "skills",
    title: "Skills",
    body: "PLACEHOLDER — no verified skill record is loaded for this tenant.",
    sourceId: CAREER_OS_SOURCE,
    verified: false,
    keywords: ["skill", "skills", "stack", "technology", "technical", "tools"],
  },
  {
    id: "know_projects_1",
    category: "projects",
    title: "Projects",
    body: "PLACEHOLDER — no verified project record is loaded for this tenant.",
    sourceId: CAREER_OS_SOURCE,
    verified: false,
    keywords: ["project", "projects", "built", "shipped", "case study"],
  },
  {
    id: "know_education_1",
    category: "education",
    title: "Education",
    body: "PLACEHOLDER — no verified education record is loaded for this tenant.",
    sourceId: CAREER_OS_SOURCE,
    verified: false,
    keywords: ["education", "degree", "school", "university", "college"],
  },
  {
    id: "know_certifications_1",
    category: "certifications",
    title: "Certifications",
    body: "PLACEHOLDER — no verified certification record is loaded for this tenant.",
    sourceId: CAREER_OS_SOURCE,
    verified: false,
    keywords: ["certification", "certified", "credential", "license"],
  },
]
