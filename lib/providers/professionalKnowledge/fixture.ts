/**
 * Deterministic professional-knowledge fixture for the ResponseOS
 * internal demo tenant (ADR-0046).
 *
 * Every record below is transcribed from one of two canonical sources:
 * the account owner's resume, imported 2026-09-10, and the public
 * portfolio at tyronenelms.com (project pages and résumé page), read
 * 2026-09-11. Nothing here is inferred: skills arrive as the flat list
 * the resume supplies, projects carry the status their own page states,
 * and no achievement, metric, or responsibility is written that neither
 * source states.
 *
 * Dates are stored at the precision the source gives them and no
 * finer — year-only where the portfolio states a year, month where it
 * states a month. Widening "2015" into a guessed month would be
 * inventing a date, which is the thing decision 5 forbids.
 *
 * One mapping is owner-confirmed rather than transcribed: the portfolio
 * carries AHLO Inc. as a single consolidated entry spanning
 * "2019 — 2023 · 2006 — 2007", while the resume splits it into two
 * roles. Both sources order the roles reverse-chronologically, which
 * implies the split below, but neither states it — so the owner
 * confirmed it instead of the ranges being assigned by inference.
 *
 * `verified: false` means "not answerable" — the receptionist offers
 * the fallback instead (lib/professional/authority.ts). Flip a record
 * to `verified: true` only when its content comes from a canonical
 * source — fabricating an employer, a date, a degree, a project, or a
 * certification is prohibited (AGENTS.md status rules; doctrine §20).
 *
 * When the Career OS adapter lands it replaces this file wholesale;
 * until then this is the canonical import and `RESUME_IMPORTED_AT`
 * marks how stale it is.
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

/** Date the resume below was imported. Bump it on every re-import. */
export const RESUME_IMPORTED_AT = "2026-09-10"

/** Date the project records were read off the public portfolio. */
export const PORTFOLIO_IMPORTED_AT = "2026-09-11"

const RESUME_SOURCE = `canonical_resume:${RESUME_IMPORTED_AT}`
const PORTFOLIO_SOURCE = `portfolio_site:${PORTFOLIO_IMPORTED_AT}`

/**
 * For a record whose claims genuinely draw on both imports. The work
 * history is the case: the resume supplies every employer and title,
 * and the portfolio résumé supplies the dates for the five roles the
 * resume leaves undated. Attributing that record to either source alone
 * would name a system that does not own half the claim.
 */
const RESUME_AND_PORTFOLIO_SOURCE = `${RESUME_SOURCE}+${PORTFOLIO_SOURCE}`
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
    id: "exp_florida_ramp_lift",
    company: "Florida Ramp & Lift",
    title: "Operations & Marketing Consultant — ADA & Mobile Lift Services",
    startDate: "2023-07",
    verified: true,
  },
  {
    id: "exp_aj_digital",
    company: "AJ Digital / Freelance Consulting",
    title: "Founder / Operations & Business Systems Consultant",
    startDate: "2020-04",
    verified: true,
  },
  {
    id: "exp_ahlo_contractor",
    company: "AHLO Inc.",
    title: "Independent Contractor — Operations & Service Support",
    startDate: "2019",
    endDate: "2023",
    verified: true,
  },
  {
    id: "exp_unitedhealthcare",
    company: "UnitedHealthcare",
    title: "Provider Services Representative",
    startDate: "2016",
    endDate: "2018",
    verified: true,
  },
  {
    id: "exp_alorica",
    company: "Alorica",
    title: "Senior Commercial Account Specialist",
    startDate: "2015",
    endDate: "2015",
    verified: true,
  },
  {
    id: "exp_tigerdirect",
    company: "TigerDirect.com (Systemax)",
    title: "Customer Service Representative",
    startDate: "2008-02",
    endDate: "2011-04",
    verified: true,
  },
  {
    id: "exp_ahlo_operations",
    company: "AHLO Inc.",
    title: "Office & Warehouse Operations",
    startDate: "2006",
    endDate: "2007",
    verified: true,
  },
]

/**
 * Transcribed from the public portfolio at tyronenelms.com/work, which
 * is already this tenant's one approved asset.
 *
 * Each summary carries the status the source states — "active
 * engagement", "internal system" — because a recruiter hearing about a
 * project assumes a shipped product unless told otherwise, and two of
 * these three have no external customers and no production deployment
 * (doctrine §20). The status rides in the summary rather than in a new
 * field: nothing in the runtime branches on it.
 */
export const demoProjects: ProjectRecord[] = [
  {
    id: "proj_frl_fieldops",
    name: "Florida Ramp & Lift FieldOps",
    summary:
      "Active engagement. A contractor portal that replaced scattered calls, texts and paper with one shared record of jobs, contractors, billing drafts, field images, safety steps and approval gates for an ADA accessibility and mobile lift service business.",
    skills: ["React", "TypeScript", "Node", "Supabase", "Systems Implementation"],
    url: "https://tyronenelms.com/work/florida-ramp-lift-fieldops",
    public: true,
    verified: true,
  },
  {
    id: "proj_career_os",
    name: "Career OS",
    summary:
      "Internal system. Opportunity sourcing, scoring, application tracking and evidence governance — a scored schema, ATS adapters and a test suite behind a hard boundary between private tracking data and public portfolio claims.",
    skills: ["Schema Design", "Python", "ATS Adapters", "Test Suite Development"],
    url: "https://tyronenelms.com/work/career-os",
    public: true,
    verified: true,
  },
  {
    id: "proj_aro",
    name: "ARO — agent execution & handoff runtime",
    summary:
      "Internal system, with no external customers and no production deployment. A runtime for long-running work that has to survive restarts, pause for a human and hand off cleanly: restart recovery, structured handoffs, pause/resume, human approval gates and provider adapters.",
    skills: ["Architecture", "Runtime Systems", "AI-Enabled Workflows"],
    url: "https://tyronenelms.com/work/aro",
    public: true,
    verified: true,
  },
]

const RESUME_SKILLS = [
  "Workflow Automation",
  "Program Management",
  "Google Workspace",
  "Process Documentation",
  "Quality Assurance",
  "SharePoint",
  "ClickUp",
  "Microsoft 365",
  "Vendor Management",
  "Salesforce",
  "CRM Systems",
  "Notion",
  "Workflow Design",
  "Operations Management",
  "Escalation Management",
  "Project Management",
  "Training & Mentoring",
  "Business Operations",
  "Process Improvement",
  "Stakeholder Management",
  "Asana",
  "AI-Enabled Workflows",
  "Customer Experience",
  "Business Systems",
  "Implementation",
  "SOP Development",
  "Team Leadership",
  "Cross-Functional Coordination",
  "Customer Success",
]

export const demoSkills: SkillRecord[] = RESUME_SKILLS.map((name) => ({
  id: `skill_${name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}`,
  name,
  verified: true,
}))

export const demoAvailabilityPolicy: AvailabilityPolicy = {
  accountId: INTERNAL_DEMO_ACCOUNT_ID,
  openToEmployment: true,
  openToConsulting: true,
  employmentTypes: ["full_time", "contract"],
  remotePreference: "remote",
  willingToRelocate: false,
  preferredTitles: [
    "Operations Consultant",
    "Customer Success Operations Manager",
    "Business Operations Analyst",
    "Operations Manager",
    "Business Operations Manager",
    "Business Systems Analyst",
    "Program Manager",
    "Implementation Manager",
  ],
  meetingDurationsMinutes: [15, 30, 45],
}

/**
 * Every entry is linked from the public portfolio, read with the
 * project records on the date in `PORTFOLIO_IMPORTED_AT`. This list is
 * the only way a link reaches a caller — answer bodies carry none — so
 * a missing entry is a link the receptionist cannot offer, whatever the
 * profile allows.
 *
 * Registration and disclosure stay separate for the email: it is listed
 * here, but only a profile whose `allowedAssetTypes` names `email` ever
 * hands it out. Today that is the recruiter profile alone.
 */
export const demoApprovedAssets: ApprovedProfessionalAsset[] = [
  {
    id: "asset_site_1",
    label: "Personal site",
    type: "portfolio",
    url: "https://tyronenelms.com",
    public: true,
  },
  {
    id: "asset_resume_1",
    label: "Résumé",
    type: "resume",
    url: "https://tyronenelms.com/resume",
    public: true,
  },
  {
    id: "asset_linkedin_1",
    label: "LinkedIn",
    type: "linkedin",
    url: "https://www.linkedin.com/in/audiojones/",
    public: true,
  },
  {
    id: "asset_github_1",
    label: "GitHub",
    type: "github",
    url: "https://github.com/AudioJones-Dev",
    public: true,
  },
  {
    id: "asset_email_1",
    label: "Email",
    type: "email",
    url: "mailto:tyrone@tyronenelms.com",
    public: true,
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
    body: "Open to full-time and contract conversations, remote, and not relocating. Interview times are confirmed against the calendar, not quoted from memory.",
    sourceId: ACCOUNT_CONFIG_SOURCE,
    verified: true,
    keywords: [
      "available",
      "availability",
      "open to",
      "contract",
      "full time",
      "remote",
      "relocate",
    ],
  },
  {
    id: "know_preferences_1",
    category: "employment_preferences",
    title: "Roles being targeted",
    body: `Targeting ${demoAvailabilityPolicy.preferredTitles.join(", ")}. Remote, without relocation.`,
    sourceId: RESUME_SOURCE,
    verified: true,
    keywords: [
      "prefer",
      "looking for",
      "interested in",
      "open to",
      "role",
      "titles",
    ],
  },
  {
    id: "know_assets_1",
    category: "projects",
    title: "Approved public assets",
    // Same reason know_projects_1 carries no URLs: this body is spoken
    // whatever the profile allows, so naming the site here would hand it
    // to a caller whose policy shares no assets at all.
    body: "Approved public assets can be shared when the answering profile allows them. Private repositories and unpublished case studies are never shared.",
    sourceId: ACCOUNT_CONFIG_SOURCE,
    verified: true,
    keywords: ["resume", "cv", "portfolio", "site", "website", "link"],
  },
  {
    id: "know_experience_1",
    category: "work_history",
    title: "Work history",
    body: "Tyrone Nelms is Operations & Marketing Consultant for ADA and mobile lift services at Florida Ramp & Lift since July 2023, and founder and operations / business systems consultant at AJ Digital since April 2020. Earlier roles: independent contractor for operations and service support at AHLO Inc. from 2019 to 2023, provider services representative at UnitedHealthcare from 2016 to 2018, senior commercial account specialist at Alorica in 2015, customer service representative at TigerDirect.com (Systemax) from February 2008 to April 2011, and office and warehouse operations at AHLO Inc. from 2006 to 2007.",
    sourceId: RESUME_AND_PORTFOLIO_SOURCE,
    verified: true,
    keywords: [
      "experience",
      "work history",
      "worked",
      "employer",
      "background",
      "career",
      "operations",
      "business systems",
    ],
  },
  {
    id: "know_skills_1",
    category: "skills",
    title: "Skills",
    body: `Operations and business-systems focused: ${RESUME_SKILLS.join(", ")}.`,
    sourceId: RESUME_SOURCE,
    verified: true,
    // Every skill name is indexed as well: a recruiter asking "does he
    // know Salesforce?" never says the word "skill".
    keywords: [
      "skill",
      "skills",
      "stack",
      "technology",
      "technical",
      "tools",
      ...RESUME_SKILLS.map((name) => name.toLowerCase()),
    ],
  },
  {
    id: "know_projects_1",
    category: "projects",
    title: "Projects",
    // Deliberately no URLs. An answer body is spoken whatever the
    // profile allows, so a link embedded here would reach callers whose
    // policy forbids portfolio assets — `allowedAssetTypes: []` is both
    // the strict default and a seeded profile. Links are handed out
    // through listShareableAssets, which enforces that policy; each
    // record still carries its `url` for that path.
    body: demoProjects
      .map((project) => `${project.name}: ${project.summary}`)
      .join(" "),
    sourceId: PORTFOLIO_SOURCE,
    verified: true,
    keywords: [
      "project",
      "projects",
      "built",
      "shipped",
      "case study",
      "portfolio",
      "fieldops",
      "career os",
      "aro",
    ],
  },
  {
    id: "know_education_1",
    category: "education",
    title: "Education",
    body: "High school diploma, American Academy.",
    sourceId: RESUME_SOURCE,
    verified: true,
    keywords: ["education", "degree", "school", "university", "college"],
  },
  {
    id: "know_certifications_1",
    category: "certifications",
    title: "Certifications",
    body: "Two Google certificates issued through Coursera: Attract and Engage Customers with Digital Marketing (completed 1 September 2024, verification https://www.coursera.org/account/accomplishments/verify/UQNCWTGZ2CAJ) and Foundations of Digital Marketing and E-commerce (completed 27 September 2023, verification https://www.coursera.org/account/accomplishments/verify/62TWK3XG9MKA).",
    sourceId: RESUME_SOURCE,
    verified: true,
    keywords: ["certification", "certified", "credential", "license", "course"],
  },
]
