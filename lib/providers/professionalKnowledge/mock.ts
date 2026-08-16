import {
  demoApprovedAssets,
  demoAvailabilityPolicy,
  demoExperience,
  demoKnowledgeRecords,
  demoProfile,
  demoProjects,
  demoSkills,
  INTERNAL_DEMO_ACCOUNT_ID,
} from "./fixture"
import type {
  ApprovedProfessionalAsset,
  AvailabilityPolicy,
  ExperienceRecord,
  ProfessionalKnowledgeProvider,
  ProfessionalKnowledgeQuery,
  ProfessionalKnowledgeResult,
  ProfessionalProfile,
  ProjectRecord,
  SkillRecord,
} from "./types"

/**
 * Deterministic fixture-backed knowledge adapter. Keyword matching only
 * — no model call, no network, no credentials. Every read is keyed by
 * `accountId`, so a tenant that has no fixture gets nothing rather than
 * another tenant's records.
 */
export class MockProfessionalKnowledgeProvider
  implements ProfessionalKnowledgeProvider
{
  readonly providerId = "mock" as const

  async search(
    input: ProfessionalKnowledgeQuery,
  ): Promise<ProfessionalKnowledgeResult[]> {
    if (input.accountId !== INTERNAL_DEMO_ACCOUNT_ID) return []
    const query = input.query.toLowerCase()
    return demoKnowledgeRecords.filter((record) =>
      record.keywords.some((keyword) => query.includes(keyword)),
    )
  }

  async getProfile(accountId: string): Promise<ProfessionalProfile | null> {
    return accountId === INTERNAL_DEMO_ACCOUNT_ID ? demoProfile : null
  }

  async getExperience(accountId: string): Promise<ExperienceRecord[]> {
    return accountId === INTERNAL_DEMO_ACCOUNT_ID ? demoExperience : []
  }

  async getProjects(accountId: string): Promise<ProjectRecord[]> {
    return accountId === INTERNAL_DEMO_ACCOUNT_ID ? demoProjects : []
  }

  async getSkills(accountId: string): Promise<SkillRecord[]> {
    return accountId === INTERNAL_DEMO_ACCOUNT_ID ? demoSkills : []
  }

  async getAvailabilityPolicy(
    accountId: string,
  ): Promise<AvailabilityPolicy | null> {
    return accountId === INTERNAL_DEMO_ACCOUNT_ID
      ? demoAvailabilityPolicy
      : null
  }

  async getApprovedAssets(
    accountId: string,
  ): Promise<ApprovedProfessionalAsset[]> {
    return accountId === INTERNAL_DEMO_ACCOUNT_ID ? demoApprovedAssets : []
  }
}
