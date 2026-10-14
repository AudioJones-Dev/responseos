import {
  BusinessMemorySnapshotSchema,
  PROSPECT_BOOTSTRAP_SCHEMA_VERSION,
  type BusinessMemorySnapshot,
} from "@/lib/prospectBootstrap/contracts";
import { contentHash } from "@/lib/prospectBootstrap/memory";
import {
  OPERATING_CONFIGURATION_REQUIREMENTS,
  isOperatingConfigurationKey,
  parseOperatingConfigurationValue,
  type OperatingConfigurationKey,
} from "./operatingConfiguration";

/**
 * Builds a tenant operating-configuration snapshot from operator-entered
 * values (ADR-0051, ADR-0057).
 *
 * Pure: no database, no clock of its own, no environment. Every fact is
 * `operator_configured` and cites the operator's approval record, because
 * operating configuration has no public page to cite. Section routing matches
 * the prospect compiler's key prefixes so both snapshots read the same way.
 */

const SECTION_FOR_KEY: Readonly<Record<OperatingConfigurationKey, keyof BusinessMemorySnapshot>> = Object.freeze({
  "business.knowledge": "businessProfile",
  "operating_hours.weekly": "operatingHours",
  "operating_hours.holidays": "operatingHours",
  "service_area.coverage": "serviceAreas",
  "contact.escalation.primary": "contactPaths",
  "policy.consent": "policies",
  "quote.photo_submission.email": "policies",
  "notification.completed_interaction.recipient": "policies",
});

export const SUPERVISED_AGENT_BOUNDARIES = Object.freeze([
  "Inbound only. Never place an outbound call.",
  "State only approved configuration and captured caller information.",
  "Never quote a binding price, promise a date, or confirm an appointment.",
  "Never infer a service area from a county, city, or landmark the caller names.",
  "Offer a human when the caller asks, is distressed, or the request is outside the approved configuration.",
  "Never give medical, legal, financial, emergency, or other regulated advice.",
]);

export interface OperatingConfigurationInput {
  key: string;
  value: unknown;
}

export interface OperatingConfigurationBuild {
  memory: BusinessMemorySnapshot;
  hash: string;
  rejected: string[];
}

export function buildOperatingConfigurationSnapshot(params: {
  accountId: string;
  generatedAt: Date;
  entries: readonly OperatingConfigurationInput[];
  assertion: { sourceId: string; recordRef: string; contentHash: string; assertedBy: string; assertedAt: Date };
  mode?: keyof typeof OPERATING_CONFIGURATION_REQUIREMENTS;
}): OperatingConfigurationBuild {
  const assertedAt = params.assertion.assertedAt.toISOString();
  const rejected: string[] = [];
  const accepted = new Map<OperatingConfigurationKey, unknown>();

  for (const entry of params.entries) {
    if (!isOperatingConfigurationKey(entry.key)) {
      rejected.push(`${entry.key}: unsupported_configuration_key`);
      continue;
    }
    const parsed = parseOperatingConfigurationValue(entry.key, entry.value);
    if (!parsed.ok) {
      rejected.push(parsed.error);
      continue;
    }
    if (accepted.has(entry.key)) {
      rejected.push(`${entry.key}: duplicate_configuration_key`);
      continue;
    }
    accepted.set(entry.key, parsed.value);
  }

  const sections: Record<string, unknown[]> = {
    businessProfile: [],
    services: [],
    locations: [],
    operatingHours: [],
    serviceAreas: [],
    faqs: [],
    policies: [],
    contactPaths: [],
    brandVoice: [],
  };

  for (const key of [...accepted.keys()].sort()) {
    const section = SECTION_FOR_KEY[key];
    sections[section].push({
      id: `operator-configured:${key}`,
      key,
      value: accepted.get(key),
      status: "operator_configured",
      sourceIds: [params.assertion.sourceId],
      sourceEvidence: [{
        kind: "operator_assertion",
        sourceId: params.assertion.sourceId,
        recordRef: params.assertion.recordRef,
        contentHash: params.assertion.contentHash,
        assertedBy: params.assertion.assertedBy,
        assertedAt,
      }],
      confidence: null,
      reviewedBy: params.assertion.assertedBy,
      reviewedAt: assertedAt,
    });
  }

  const required = OPERATING_CONFIGURATION_REQUIREMENTS[params.mode ?? "SUPERVISED_PILOT"];
  const satisfied = new Set<string>(
    [...accepted.keys()].map((key) => (key === "contact.escalation.primary" ? "contact.escalation" : key)),
  );

  const memory = BusinessMemorySnapshotSchema.parse({
    schemaVersion: PROSPECT_BOOTSTRAP_SCHEMA_VERSION,
    bootstrapId: null,
    accountId: params.accountId,
    generatedAt: params.generatedAt.toISOString(),
    ...sections,
    unknowns: required
      .filter((requirement) => !satisfied.has(requirement))
      .map((requirement) => `${requirement} has no approved value.`),
    conflicts: [],
    agentBoundaries: [...SUPERVISED_AGENT_BOUNDARIES],
    sourceManifest: [{
      kind: "operator_assertion",
      id: params.assertion.sourceId,
      recordRef: params.assertion.recordRef,
      contentHash: params.assertion.contentHash,
      assertedAt,
    }],
  });

  return { memory, hash: contentHash(memory), rejected };
}
