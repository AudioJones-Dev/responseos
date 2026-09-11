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
   *
   * A record whose claims genuinely draw on more than one system names
   * all of them, joined by "+". Naming one source for a body that mixes
   * two would misattribute the half it does not own, which is the same
   * failure as citing no source at all.
   *
   * This binds every adapter, not just the fixture (ADR-0046, fifth
   * follow-up): an adapter that cannot name every system behind a claim
   * must split the claim into records it can attribute. A consumer that
   * needs the individual sources splits on "+"; one that only displays
   * or logs provenance may treat the field as opaque.
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
  | "email"

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
  /** Omitted when the canonical record carries no date. Never inferred. */
  startDate?: string
  endDate?: string
  summary?: string
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
  /** Omitted when the canonical record supplies a flat, uncategorized list. */
  category?: string
  verified: boolean
}

export interface AvailabilityPolicy {
  accountId: string
  openToEmployment: boolean
  openToConsulting: boolean
  employmentTypes: string[]
  remotePreference: string
  willingToRelocate: boolean
  /** Role titles the owner is targeting, in the owner's own words. */
  preferredTitles: string[]
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
