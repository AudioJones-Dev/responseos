import {
  BusinessMemorySnapshotSchema,
  PROSPECT_BOOTSTRAP_SCHEMA_VERSION,
  type BusinessMemorySnapshot,
} from "@/lib/prospectBootstrap/contracts";
import { OPERATING_CONFIGURATION_REQUIREMENTS } from "@/lib/agentExecution/operatingConfiguration";

/**
 * Florida Ramp & Lift: the ADR-0035 anchor case study and the planned first
 * supervised-pilot client. No FRL tenant exists yet, so the caller supplies the
 * account id.
 *
 * Skeleton only, within the boundary the operator approved on 2026-09-11: the
 * business name, zero facts, and every supervised-pilot requirement recorded as
 * unknown. No PII, customer data, pricing, phone numbers, or provider
 * identifiers. Facts are meant to enter through the operating-configuration write
 * path (RESPONSEOS_CLIENT_OPERATING_CONFIGURATION_STANDARD.md §7, ROADMAP), not
 * by editing this module.
 */
export const FLORIDA_RAMP_LIFT_BUSINESS_NAME = "Florida Ramp & Lift";

export function floridaRampLiftOperatingConfiguration(params: {
  accountId: string;
  generatedAt?: Date;
}): BusinessMemorySnapshot {
  return BusinessMemorySnapshotSchema.parse({
    schemaVersion: PROSPECT_BOOTSTRAP_SCHEMA_VERSION,
    bootstrapId: null,
    accountId: params.accountId,
    generatedAt: (params.generatedAt ?? new Date()).toISOString(),
    businessProfile: [],
    services: [],
    locations: [],
    operatingHours: [],
    serviceAreas: [],
    faqs: [],
    policies: [],
    contactPaths: [],
    brandVoice: [],
    unknowns: OPERATING_CONFIGURATION_REQUIREMENTS.SUPERVISED_PILOT.map(
      (requirement) => `${requirement} has no approved value.`,
    ),
    conflicts: [],
    agentBoundaries: [],
    sourceManifest: [],
  });
}
