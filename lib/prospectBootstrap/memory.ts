import { createHash } from "node:crypto";
import {
  BusinessMemorySnapshotSchema,
  PROSPECT_AGENT_TEMPLATE_VERSION,
  PROSPECT_BOOTSTRAP_SCHEMA_VERSION,
  ProspectAgentContextSchema,
  type BusinessMemorySnapshot,
  type ProspectAgentContext,
} from "./contracts";

interface CompilableFact {
  id: string;
  fact_key: string;
  value_json: unknown;
  status: string;
  source_id: string;
  source_ids_json?: unknown;
  source_evidence_json?: unknown;
  evidence_excerpt?: string;
  confidence?: number | null;
  reviewed_by?: string | null;
  reviewed_at?: Date | null;
  valid_as_of?: Date | null;
  conflict_group?: string | null;
}

interface CompilableSource {
  id: string;
  normalized_url: string;
  content_hash?: string | null;
  fetched_at?: Date | null;
}

const MULTI_VALUE_FACT_KEYS = new Set([
  "contact.phone",
  "contact.email",
  "operating_hours.statement",
  "service.statement",
  "service_area.statement",
  "policy.statement",
  "location.statement",
]);

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stableValue(nested)]),
    );
  }
  return value;
}

export function stableJson(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

export function contentHash(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function sectionForFactKey(key: string): keyof Pick<
  BusinessMemorySnapshot,
  "businessProfile" | "services" | "locations" | "operatingHours" | "serviceAreas" | "faqs" | "policies" | "contactPaths" | "brandVoice"
> {
  if (key.startsWith("service.")) return "services";
  if (key.startsWith("location.")) return "locations";
  if (key.startsWith("operating_hours.")) return "operatingHours";
  if (key.startsWith("service_area.")) return "serviceAreas";
  if (key.startsWith("faq.")) return "faqs";
  if (key.startsWith("policy.")) return "policies";
  if (key.startsWith("contact.")) return "contactPaths";
  if (key.startsWith("brand_voice.")) return "brandVoice";
  return "businessProfile";
}

function authorityRank(status: string): number {
  if (status === "owner_confirmed") return 2;
  if (status === "operator_approved_for_demo") return 1;
  return 0;
}

function compareFactAuthority(left: CompilableFact, right: CompilableFact): number {
  const rank = authorityRank(right.status) - authorityRank(left.status);
  if (rank !== 0) return rank;
  const reviewed = (right.reviewed_at?.getTime() ?? 0) - (left.reviewed_at?.getTime() ?? 0);
  if (reviewed !== 0) return reviewed;
  const validAsOf = (right.valid_as_of?.getTime() ?? 0) - (left.valid_as_of?.getTime() ?? 0);
  if (validAsOf !== 0) return validAsOf;
  return left.id.localeCompare(right.id);
}

function selectApprovedFacts(facts: CompilableFact[]): CompilableFact[] {
  const approved = facts.filter((fact) => (
    fact.status === "operator_approved_for_demo" || fact.status === "owner_confirmed"
  ));
  const byKey = new Map<string, CompilableFact[]>();
  for (const fact of approved) {
    const group = byKey.get(fact.fact_key) ?? [];
    group.push(fact);
    byKey.set(fact.fact_key, group);
  }

  const selected: CompilableFact[] = [];
  for (const [key, group] of byKey) {
    if (!MULTI_VALUE_FACT_KEYS.has(key)) {
      selected.push([...group].sort(compareFactAuthority)[0]);
      continue;
    }
    const byValue = new Map<string, CompilableFact[]>();
    for (const fact of group) {
      const signature = stableJson(fact.value_json);
      const valueGroup = byValue.get(signature) ?? [];
      valueGroup.push(fact);
      byValue.set(signature, valueGroup);
    }
    for (const valueGroup of byValue.values()) {
      selected.push([...valueGroup].sort(compareFactAuthority)[0]);
    }
  }
  return selected;
}

export function compileBusinessMemorySnapshot(params: {
  bootstrapId: string;
  accountId: string;
  facts: CompilableFact[];
  sources: CompilableSource[];
  unknowns: string[];
  generatedAt?: Date;
}): { memory: BusinessMemorySnapshot; hash: string } {
  const sourceById = new Map(params.sources.map((source) => [source.id, source]));
  const memory: BusinessMemorySnapshot = {
    schemaVersion: PROSPECT_BOOTSTRAP_SCHEMA_VERSION,
    bootstrapId: params.bootstrapId,
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
    unknowns: [...new Set(params.unknowns)].sort(),
    conflicts: [...new Set(params.facts.flatMap((fact) => fact.status === "conflicted" && fact.conflict_group ? [fact.conflict_group] : []))].sort(),
    agentBoundaries: [
      "Inbound supervised demonstration only.",
      "Do not schedule, collect payment, transfer, or make binding commitments.",
      "Do not provide medical, legal, financial, or emergency advice.",
      "Use the uncertainty fallback whenever an approved fact is unavailable.",
    ],
    sourceManifest: params.sources
      .filter((source) => source.content_hash && source.fetched_at)
      .map((source) => ({
        id: source.id,
        url: source.normalized_url,
        contentHash: source.content_hash!,
        fetchedAt: source.fetched_at!.toISOString(),
      }))
      .sort((left, right) => left.url.localeCompare(right.url)),
  };

  for (const fact of selectApprovedFacts(params.facts)) {
    const sourceIds = Array.isArray(fact.source_ids_json)
      ? fact.source_ids_json.filter((value): value is string => typeof value === "string" && sourceById.has(value))
      : [fact.source_id];
    const source = sourceById.get(sourceIds[0]);
    if (!source?.content_hash || !source.fetched_at) continue;
    if (!fact.reviewed_by || !fact.reviewed_at) {
      throw new Error(`approved_fact_review_metadata_missing:${fact.id}`);
    }
    const storedEvidence = Array.isArray(fact.source_evidence_json)
      ? fact.source_evidence_json
      : [];
    const sourceEvidence = sourceIds.map((sourceId) => {
      const evidence = storedEvidence.find((value) => (
        value && typeof value === "object" && !Array.isArray(value) && (value as Record<string, unknown>).sourceId === sourceId
      )) as Record<string, unknown> | undefined;
      const linkedSource = sourceById.get(sourceId);
      if (!linkedSource?.content_hash || !linkedSource.fetched_at) return null;
      return {
        sourceId,
        sourceUrl: linkedSource.normalized_url,
        contentHash: linkedSource.content_hash,
        evidenceExcerptHash: typeof evidence?.evidenceExcerptHash === "string"
          ? evidence.evidenceExcerptHash
          : contentHash(fact.evidence_excerpt ?? ""),
        fetchedAt: linkedSource.fetched_at.toISOString(),
      };
    }).filter((value): value is NonNullable<typeof value> => Boolean(value));
    if (sourceEvidence.length === 0) continue;
    const target = sectionForFactKey(fact.fact_key);
    memory[target].push({
      id: fact.id,
      key: fact.fact_key,
      value: fact.value_json,
      status: fact.status as "operator_approved_for_demo" | "owner_confirmed",
      sourceIds,
      sourceEvidence,
      confidence: fact.confidence ?? null,
      reviewedBy: fact.reviewed_by,
      reviewedAt: fact.reviewed_at.toISOString(),
      ...(fact.valid_as_of ? { validAsOf: fact.valid_as_of.toISOString() } : {}),
    });
  }

  for (const section of [
    "businessProfile",
    "services",
    "locations",
    "operatingHours",
    "serviceAreas",
    "faqs",
    "policies",
    "contactPaths",
    "brandVoice",
  ] as const) {
    memory[section].sort((left, right) => `${left.key}:${left.id}`.localeCompare(`${right.key}:${right.id}`));
  }

  const validated = BusinessMemorySnapshotSchema.parse(memory);
  return { memory: validated, hash: contentHash(validated) };
}

function values(memory: BusinessMemorySnapshot): string[] {
  return [
    ...memory.businessProfile,
    ...memory.services,
    ...memory.locations,
    ...memory.operatingHours,
    ...memory.serviceAreas,
    ...memory.faqs,
    ...memory.policies,
    ...memory.contactPaths,
    ...memory.brandVoice,
  ].map((fact) => `${fact.key}: ${typeof fact.value === "string" ? fact.value : stableJson(fact.value)}`);
}

export function compileProspectAgentContext(params: {
  businessName: string;
  businessWebsite: string;
  memory: BusinessMemorySnapshot;
}): ProspectAgentContext {
  const approvedContext = [
    `Template: ${PROSPECT_AGENT_TEMPLATE_VERSION}`,
    ...values(params.memory),
    ...params.memory.unknowns.map((unknown) => `UNKNOWN: ${unknown}`),
  ].join("\n");
  return ProspectAgentContextSchema.parse({
    demo_available: "true",
    execution_mode: "PROSPECT_DEMO",
    business_name: params.businessName,
    business_website: params.businessWebsite,
    approved_business_context: approvedContext,
    knowledge_as_of: params.memory.generatedAt,
    uncertainty_fallback: "I don't have verified information available for that. I can capture a request for a human callback.",
  });
}
