import { z } from "zod";

export const PROSPECT_BOOTSTRAP_SCHEMA_VERSION = "prospect-bootstrap.v1";
export const PROSPECT_AGENT_TEMPLATE_VERSION = "home-services-receptionist.v1";
export const PROSPECT_ACTIVE_DAYS = 14;
export const PROSPECT_REVIEW_DAYS = 7;
export const PROSPECT_CONTENT_RETENTION_DAYS = 30;
export const PROSPECT_NUMBER_QUARANTINE_DAYS = 14;
export const PROSPECT_AUDIT_RETENTION_DAYS = 365;

export const ProspectBootstrapStatusSchema = z.enum([
  "draft",
  "ingesting",
  "review_required",
  "approved",
  "provisioning",
  "ready",
  "active",
  "completed",
  "promotion_pending",
  "converted",
  "expired",
  "cleanup_pending",
  "cleaned",
  "failed",
]);

export type ProspectBootstrapStatus = z.infer<typeof ProspectBootstrapStatusSchema>;

export const KnowledgeFactStatusSchema = z.enum([
  "source_observed",
  "cross_source_confirmed",
  "operator_approved_for_demo",
  "owner_confirmed",
  "conflicted",
  "rejected",
]);

export type KnowledgeFactStatus = z.infer<typeof KnowledgeFactStatusSchema>;

export const ApprovedKnowledgeFactSchema = z.object({
  id: z.string().min(1),
  key: z.string().min(1),
  value: z.unknown(),
  status: z.enum(["operator_approved_for_demo", "owner_confirmed"]),
  sourceIds: z.array(z.string().min(1)).min(1),
  sourceEvidence: z.array(z.object({
    sourceId: z.string().min(1),
    sourceUrl: z.url({ protocol: /^https$/ }),
    contentHash: z.string().length(64),
    evidenceExcerptHash: z.string().length(64),
    fetchedAt: z.iso.datetime(),
  })).min(1),
  confidence: z.number().min(0).max(1).nullable(),
  reviewedBy: z.string().min(1),
  reviewedAt: z.iso.datetime(),
  validAsOf: z.iso.datetime().optional(),
});

export const PROSPECT_MEMORY_UNKNOWNS = Object.freeze([
  "Binding prices and quotes require human confirmation.",
  "Scheduling availability is not connected in the prospect demo.",
  "Unlisted services, policies, and operating details are unknown.",
]);

const SourceManifestItemSchema = z.object({
  id: z.string().min(1),
  url: z.url({ protocol: /^https$/ }),
  contentHash: z.string().min(32),
  fetchedAt: z.iso.datetime(),
});

export const BusinessMemorySnapshotSchema = z.object({
  schemaVersion: z.literal(PROSPECT_BOOTSTRAP_SCHEMA_VERSION),
  bootstrapId: z.string().min(1).nullable(),
  accountId: z.string().min(1),
  generatedAt: z.iso.datetime(),
  businessProfile: z.array(ApprovedKnowledgeFactSchema),
  services: z.array(ApprovedKnowledgeFactSchema),
  locations: z.array(ApprovedKnowledgeFactSchema),
  operatingHours: z.array(ApprovedKnowledgeFactSchema),
  serviceAreas: z.array(ApprovedKnowledgeFactSchema),
  faqs: z.array(ApprovedKnowledgeFactSchema),
  policies: z.array(ApprovedKnowledgeFactSchema),
  contactPaths: z.array(ApprovedKnowledgeFactSchema),
  brandVoice: z.array(ApprovedKnowledgeFactSchema),
  unknowns: z.array(z.string().min(1)),
  conflicts: z.array(z.string().min(1)),
  agentBoundaries: z.array(z.string().min(1)),
  sourceManifest: z.array(SourceManifestItemSchema),
});

export type BusinessMemorySnapshot = z.infer<typeof BusinessMemorySnapshotSchema>;

export const ProspectAgentContextSchema = z.object({
  demo_available: z.literal("true"),
  execution_mode: z.literal("PROSPECT_DEMO"),
  business_name: z.string().min(1),
  business_website: z.url({ protocol: /^https$/ }),
  approved_business_context: z.string().min(1).max(24_000),
  knowledge_as_of: z.iso.datetime(),
  uncertainty_fallback: z.literal("I don't have verified information available for that. I can capture a request for a human callback."),
});

export type ProspectAgentContext = z.infer<typeof ProspectAgentContextSchema>;

export const UnavailableAgentContextSchema = z.object({
  demo_available: z.literal("false"),
  execution_mode: z.literal("PROSPECT_DEMO_UNAVAILABLE"),
  business_name: z.literal("ResponseOS demonstration"),
  approved_business_context: z.literal("This personalized demonstration is not currently active."),
  uncertainty_fallback: z.literal("This personalized demonstration is unavailable. Please contact AJ Digital for a supervised demonstration."),
});

export const BootstrapPromotionManifestSchema = z.object({
  schemaVersion: z.literal("prospect-promotion.v1"),
  correlationId: z.string().min(1),
  sourceBootstrapId: z.string().min(1),
  sourceAccountId: z.string().min(1),
  sourceSnapshotId: z.string().min(1),
  sourceSnapshotHash: z.string().min(32),
  exportedAt: z.iso.datetime(),
  businessIdentity: z.object({
    name: z.string().min(1),
    canonicalWebsite: z.url({ protocol: /^https$/ }),
    industry: z.literal("home-services"),
    timezone: z.string().min(1),
  }),
  memory: BusinessMemorySnapshotSchema,
  agent: z.object({
    templateVersion: z.literal(PROSPECT_AGENT_TEMPLATE_VERSION),
    executionMode: z.literal("PROSPECT_DEMO"),
    policy: z.record(z.string(), z.unknown()),
  }),
  numberRetentionIntent: z.enum(["new_production_number", "request_demo_number_review"]),
});

export type BootstrapPromotionManifest = z.infer<typeof BootstrapPromotionManifestSchema>;
