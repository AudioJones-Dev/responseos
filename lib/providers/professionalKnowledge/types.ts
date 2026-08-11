export type ProfessionalKnowledgeProviderId = "mock" | "career_os"

/**
 * Claim categories the receptionist can be asked about. The authority
 * each category carries — answer, tool lookup, escalate, refuse — lives
 * in lib/professional/authority.ts, not here: this module only supplies
 * knowledge, it never decides what may be said.
 */
export type ProfessionalKnowledgeCategory =
  | "profile"
  | "work_history"
  | "skills"
  | "projects"
  | "case_studies"
  | "education"
  | "certifications"
  | "employment_preferences"
  | "contract_availability"
  | "interview_availability"
  | "compensation"
  | "consulting_rates"
  | "references"
  | "personal"
  | "unknown"

export interface ProfessionalKnowledgeResult {
  id: string
  category: ProfessionalKnowledgeCategory
  title: string
  body: string
  /**
   * Provenance of the claim. Every record names the system that owns
   * the truth so an answer can cite it — the receptionist never
   * asserts a professional fact it cannot attribute.
   */
  sourceId: string
  /**
   * `false` means the record exists but has not been confirmed against
   * a canonical source. Unverified records are never spoken as fact;
   * the caller receives the fallback line instead.
   */
  verified: boolean
  /** Matching terms used by the deterministic mock adapter. */
  keywords: string[]
}

export type ProfessionalAssetType =
  | "resume"
  | "portfolio"
  | "linkedin"
  | "github"
  | "case_study"

export interface ApprovedProfessionalAsset {
  id: string
  label: string
  type: ProfessionalAssetType
  url: string
  /** Only public assets may ever be handed to a caller. */
  public: boolean
}

export interface ProfessionalProfile {
  accountId: string
  /** Display name the receptionist speaks on behalf of. */
  ownerName: string
  headline: string
  summary: string
  location: string
  verified: boolean
}

export interface ExperienceRecord {
  id: string
  company: string
  title: string
  startDate: string
  endDate?: string
  summary: string
  verified: boolean
}

export interface ProjectRecord {
  id: string
  name: string
  summary: string
  skills: string[]
  url?: string
  public: boolean
  verified: boolean
}

export interface SkillRecord {
  id: string
  name: string
  category: string
  verified: boolean
}

export interface AvailabilityPolicy {
  accountId: string
  openToEmployment: boolean
  openToConsulting: boolean
  employmentTypes: string[]
  remotePreference: string
  meetingDurationsMinutes: number[]
}

export interface ProfessionalKnowledgeQuery {
  accountId: string
  query: string
  profileType: string
}

export interface ProfessionalKnowledgeProvider {
  readonly providerId: ProfessionalKnowledgeProviderId
  search(input: ProfessionalKnowledgeQuery): Promise<ProfessionalKnowledgeResult[]>
  getProfile(accountId: string): Promise<ProfessionalProfile | null>
  getExperience(accountId: string): Promise<ExperienceRecord[]>
  getProjects(accountId: string): Promise<ProjectRecord[]>
  getSkills(accountId: string): Promise<SkillRecord[]>
  getAvailabilityPolicy(accountId: string): Promise<AvailabilityPolicy | null>
  getApprovedAssets(accountId: string): Promise<ApprovedProfessionalAsset[]>
}
