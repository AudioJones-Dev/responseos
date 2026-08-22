import { z } from "zod";
import {
  BusinessMemorySnapshotSchema,
  PROSPECT_AGENT_TEMPLATE_VERSION,
} from "@/lib/prospectBootstrap/contracts";

export const CLIENT_ENVIRONMENT_SCHEMA_VERSION = "client-environment.v1";
export const CLIENT_ENVIRONMENT_TEMPLATE_VERSION = "responseos-client-environment.v1";

export const ClientEnvironmentStageSchema = z.enum([
  "discovery",
  "implementation_ready",
]);

export type ClientEnvironmentStage = z.infer<typeof ClientEnvironmentStageSchema>;

export const DiscoveryFindingAuthoritySchema = z.enum([
  "consultant_observed",
  "client_stated",
  "client_confirmed",
]);

export type DiscoveryFindingAuthority = z.infer<typeof DiscoveryFindingAuthoritySchema>;

export const DiscoveryFindingInputSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_.-]{2,79}$/),
  value: z.unknown(),
  evidenceNote: z.string().trim().min(1).max(2_000),
  authority: DiscoveryFindingAuthoritySchema,
  assessmentReportId: z.string().min(1).optional(),
  validAsOf: z.iso.datetime().optional(),
});

export type DiscoveryFindingInput = z.infer<typeof DiscoveryFindingInputSchema>;

export const DiscoveryFindingReviewSchema = z.object({
  decision: z.enum([
    "operator_approved_for_demo",
    "owner_confirmed",
    "rejected",
  ]),
});

export type DiscoveryFindingReview = z.infer<typeof DiscoveryFindingReviewSchema>;

export const ClientEnvironmentManifestSchema = z.object({
  schemaVersion: z.literal(CLIENT_ENVIRONMENT_SCHEMA_VERSION),
  templateVersion: z.literal(CLIENT_ENVIRONMENT_TEMPLATE_VERSION),
  generatedAt: z.iso.datetime(),
  accountId: z.string().min(1),
  sourceBootstrapId: z.string().min(1),
  lifecycleStage: ClientEnvironmentStageSchema,
  businessIdentity: z.object({
    name: z.string().min(1),
    canonicalWebsite: z.url({ protocol: /^https$/ }),
    industry: z.string().min(1),
    timezone: z.string().min(1),
  }),
  context: z.object({
    snapshotId: z.string().min(1),
    snapshotHash: z.string().length(64),
    snapshotVersion: z.number().int().positive(),
    memory: BusinessMemorySnapshotSchema,
  }),
  discovery: z.object({
    assessmentReportIds: z.array(z.string().min(1)),
    discoverySourceCount: z.number().int().nonnegative(),
    approvedFindingCount: z.number().int().nonnegative(),
    pendingFindingCount: z.number().int().nonnegative(),
  }),
  agent: z.object({
    templateVersion: z.literal(PROSPECT_AGENT_TEMPLATE_VERSION),
    policyHash: z.string().length(64),
    executionMode: z.literal("DISCOVERY_PREVIEW"),
    liveActivationAuthorized: z.literal(false),
  }),
  integrations: z.object({
    telephony: z.literal("review_required"),
    crm: z.literal("disabled"),
    scheduling: z.literal("disabled"),
    payments: z.literal("disabled"),
  }),
  promotion: z.object({
    tenantIdentityPreserved: z.literal(true),
    requiresSeparateLiveGate: z.literal(true),
  }),
});

export type ClientEnvironmentManifest = z.infer<typeof ClientEnvironmentManifestSchema>;
