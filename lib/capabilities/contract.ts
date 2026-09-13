import { contentHash } from "@/lib/prospectBootstrap/memory";
import type { ExecutionMode } from "@/lib/agentExecution/policy";

/**
 * The shared capability contract (ADR-0054).
 *
 * A capability descriptor is the Git-authored definition of record for one
 * governed unit of ResponseOS behaviour. It is frozen, checksummed, and
 * reviewed through the normal PR process; the database holds only release
 * assignments, runs, and evidence.
 *
 * Every field below is carried because *both* currently described capabilities
 * need it — the prospect receptionist and inbound lead qualification. Fields
 * the research brief proposed but neither capability demonstrates (generic
 * `steps[]`, a four-state evidence enum, an independent component-version
 * registry) are deliberately absent. ADR-0054 decision 8: generalize from two
 * verified implementations, not from one implementation plus an ontology.
 *
 * This contract describes capabilities. It does not execute them.
 */

/**
 * Deliberately a two-value union rather than a reuse of `AutomationTriggerType`
 * or `LeadEventSource`.
 *
 * `AutomationTriggerType` is n8n automation configuration (ADR-0017) and has no
 * inbound-call member; `LeadEventSource` describes where a lead came from, not
 * what starts a capability. Widening either to fit would be the naming
 * collision ADR-0054 decision 9 exists to prevent. Two values because two
 * capabilities prove two values — add a third when a third capability needs it.
 */
export type CapabilityTrigger = "inbound_call" | "lead_form";

/**
 * Record types a capability produces, named as the Prisma models they are.
 * Grounded in the writers in `lib/providers/telnyx/normalize.ts`, which is the
 * only production path that currently writes any of them.
 */
export type CapabilityRecord =
  | "Contact"
  | "Call"
  | "CallTranscript"
  | "LeadEvent"
  | "LeadQualification";

export interface CapabilityDescriptor {
  /** Stable identity. Never changes across versions. */
  readonly slug: string;
  readonly name: string;
  /**
   * Human-readable version label, e.g. `home-services-receptionist.v1`.
   * For humans and logs only — never trusted for resolution, because a label
   * can be reused by mistake and a checksum cannot (ADR-0054 q5).
   */
  readonly versionLabel: string;
  /** The operational outcome this capability exists to produce. */
  readonly objective: string;
  readonly triggers: readonly CapabilityTrigger[];
  /** Context sources the capability may read. Tenant-scoped at the data layer. */
  readonly requiredContext: readonly string[];
  /**
   * Fields that must be known before the capability may reach its outcome.
   * Expressed over vocabulary that already exists (`KnowledgeFactStatus`,
   * `knowledgeFallback: "verified_only"`, non-nullable columns) rather than a
   * new evidence enum.
   */
  readonly requiredKnownFields: readonly string[];
  /**
   * The least permissive execution mode that can run this capability. The
   * effective tool set is the intersection of `allowedTools` here with the
   * resolved `ExecutionPolicy` for the tenant's mode — never the union
   * (ADR-0054 decision 5).
   */
  readonly minimumExecutionMode: ExecutionMode;
  readonly allowedTools: readonly string[];
  readonly producesRecords: readonly CapabilityRecord[];
}

/**
 * Identity of a published capability version.
 *
 * Reuses `contentHash`, which canonicalizes key order via `stableJson`, so two
 * descriptors that differ only in field order hash identically. Deliberately
 * not a third hashing scheme — `PROSPECT_RECEPTIONIST_TEMPLATE_CHECKSUM` and
 * `BootstrapPromotion.manifest_hash` already establish SHA-256-over-content as
 * the repository's convention.
 */
export function capabilityChecksum(descriptor: CapabilityDescriptor): string {
  return contentHash(descriptor);
}
