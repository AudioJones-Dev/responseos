import "@/lib/serverOnlyGuard";
import { randomUUID } from "node:crypto";
import type { Account, ProspectBootstrap } from "@prisma/client";
import { db } from "@/lib/db/client";
import { getCurrentSession } from "@/lib/auth/session";
import { isCrossTenantRole } from "@/lib/data/session-helpers";
import { err, errFromThrown, ok, type Result } from "@/lib/data/result";
import {
  BusinessMemorySnapshotSchema,
  PROSPECT_AGENT_TEMPLATE_VERSION,
  PROSPECT_AUDIT_RETENTION_DAYS,
  PROSPECT_MEMORY_UNKNOWNS,
} from "@/lib/prospectBootstrap/contracts";
import {
  compileBusinessMemorySnapshot,
  contentHash,
} from "@/lib/prospectBootstrap/memory";
import {
  CLIENT_ENVIRONMENT_SCHEMA_VERSION,
  CLIENT_ENVIRONMENT_TEMPLATE_VERSION,
  ClientEnvironmentManifestSchema,
  DiscoveryFindingInputSchema,
  DiscoveryFindingReviewSchema,
  type ClientEnvironmentManifest,
  type DiscoveryFindingAuthority,
} from "./contracts";

const APPROVED_FACT_STATUSES = ["operator_approved_for_demo", "owner_confirmed"] as const;
const PENDING_FACT_STATUSES = ["source_observed", "cross_source_confirmed", "conflicted"] as const;

interface DiscoveryPromotionResult {
  replay: boolean;
  account: Account;
  bootstrap: ProspectBootstrap;
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

async function requireOperator() {
  const session = await getCurrentSession();
  if (!session) return err("no_session", "No active session.");
  if (!isCrossTenantRole(session)) return err("role_denied", "Operator access is required.");
  return ok(session);
}

function discoveryStatus(authority: DiscoveryFindingAuthority) {
  if (authority === "client_confirmed") return "owner_confirmed" as const;
  if (authority === "consultant_observed") return "operator_approved_for_demo" as const;
  return "source_observed" as const;
}

function discoverySourceUrl(params: {
  bootstrapId: string;
  assessmentReportId?: string;
  sourceId: string;
}) {
  const parent = params.assessmentReportId
    ? `assessment/${encodeURIComponent(params.assessmentReportId)}`
    : "session/manual";
  return `https://evidence.responseos.invalid/${parent}/${encodeURIComponent(params.bootstrapId)}/${params.sourceId}`;
}

function auditExpiry(now: Date) {
  return addDays(now, PROSPECT_AUDIT_RETENTION_DAYS);
}

export async function promoteProspectToDiscovery(params: {
  bootstrapId: string;
  promotionAcknowledged: boolean;
}, now = new Date()): Promise<Result<DiscoveryPromotionResult>> {
  const operator = await requireOperator();
  if (!operator.ok) return operator;
  if (params.promotionAcknowledged !== true) {
    return err(
      "promotion_acknowledgment_required",
      "Confirm that the demo is complete and that promotion preserves the existing tenant while live integrations remain disabled.",
    );
  }
  if (!db) return err("no_database", "Client-environment promotion requires DATABASE_URL.");

  try {
    const bootstrap = await db.prospectBootstrap.findUnique({ where: { id: params.bootstrapId } });
    if (!bootstrap) return err("not_found", "Prospect bootstrap was not found.");
    if (bootstrap.status === "converted") {
      const account = await db.account.findUnique({ where: { id: bootstrap.account_id } });
      if (!account) return err("account_missing", "The promoted tenant account is missing.");
      return ok<DiscoveryPromotionResult>({ replay: true, account, bootstrap });
    }
    if (bootstrap.status !== "completed" || !bootstrap.current_memory_snapshot_id) {
      return err("bootstrap_not_completed", "Complete the supervised demo before promoting it to discovery.");
    }
    if (bootstrap.promotion_correlation_id) {
      return err(
        "legacy_promotion_in_progress",
        "This bootstrap already entered the export/import promotion path and cannot be promoted in place.",
      );
    }

    const [account, snapshot] = await Promise.all([
      db.account.findUnique({ where: { id: bootstrap.account_id } }),
      db.businessMemorySnapshot.findUnique({ where: { id: bootstrap.current_memory_snapshot_id } }),
    ]);
    if (!account || account.account_type !== "sandbox") {
      return err("promotion_account_invalid", "In-place promotion requires the original sandbox tenant.");
    }
    if (!snapshot || snapshot.account_id !== account.id || snapshot.status !== "approved") {
      return err("promotion_snapshot_invalid", "The current approved snapshot is unavailable.");
    }

    const promoted = await db.$transaction(async (tx) => {
      await tx.knowledgeFact.updateMany({
        where: {
          account_id: account.id,
          bootstrap_id: bootstrap.id,
          status: { in: [...APPROVED_FACT_STATUSES] },
        },
        data: { expires_at: null },
      });
      const updatedBootstrap = await tx.prospectBootstrap.update({
        where: { id: bootstrap.id },
        data: {
          status: "converted",
          converted_at: now,
          active_account_key: null,
          review_expires_at: null,
          expires_at: null,
          content_expires_at: null,
        },
      });
      await tx.auditLog.create({
        data: {
          account_id: account.id,
          actor_user_id: operator.data.user.id,
          actor_type: "user",
          actor_role: operator.data.user.role,
          action: "client_environment.promoted_to_discovery",
          category: "workflow",
          target_type: "Account",
          target_id: account.id,
          reason: "Operator promoted the completed demo into discovery without replacing the tenant identity.",
          metadata_json: {
            bootstrapId: bootstrap.id,
            sourceSnapshotId: snapshot.id,
            tenantIdentityPreserved: true,
            accountType: account.account_type,
            liveActivationAuthorized: false,
            rawSourceRetentionUnchanged: true,
          },
          expires_at: auditExpiry(now),
        },
      });
      return updatedBootstrap;
    });

    return ok<DiscoveryPromotionResult>({ replay: false, account, bootstrap: promoted });
  } catch (error) {
    return errFromThrown<DiscoveryPromotionResult>(error);
  }
}

export async function createDiscoveryFinding(params: {
  accountId: string;
  input: unknown;
}, now = new Date()) {
  const operator = await requireOperator();
  if (!operator.ok) return operator;
  if (!db) return err("no_database", "Discovery findings require DATABASE_URL.");

  const parsed = DiscoveryFindingInputSchema.safeParse(params.input);
  if (!parsed.success) return err("invalid_discovery_finding", "Discovery finding input is invalid.");
  const input = parsed.data;

  try {
    const [account, bootstrap] = await Promise.all([
      db.account.findUnique({ where: { id: params.accountId } }),
      db.prospectBootstrap.findFirst({
        where: { account_id: params.accountId, status: "converted" },
        orderBy: { converted_at: "desc" },
      }),
    ]);
    if (!account || account.account_type !== "sandbox") {
      return err("discovery_account_invalid", "Discovery enrichment is currently limited to promoted sandbox tenants.");
    }
    if (!bootstrap) return err("discovery_bootstrap_missing", "Promote the completed demo before recording discovery findings.");

    if (input.assessmentReportId) {
      const assessment = await db.assessmentReport.findUnique({ where: { id: input.assessmentReportId } });
      if (!assessment || assessment.account_id !== account.id) {
        return err("assessment_out_of_scope", "The assessment report does not belong to this tenant.");
      }
    }

    const sourceId = randomUUID();
    const sourceUrl = discoverySourceUrl({
      bootstrapId: bootstrap.id,
      assessmentReportId: input.assessmentReportId,
      sourceId,
    });
    const status = discoveryStatus(input.authority);
    const reviewed = status === "operator_approved_for_demo" || status === "owner_confirmed";
    const validAsOf = input.validAsOf ? new Date(input.validAsOf) : now;
    const evidenceExcerptHash = contentHash(input.evidenceNote);
    const sourceContentHash = contentHash({
      authority: input.authority,
      assessmentReportId: input.assessmentReportId ?? null,
      evidenceNote: input.evidenceNote,
      key: input.key,
      validAsOf: validAsOf.toISOString(),
      value: input.value,
    });

    const created = await db.$transaction(async (tx) => {
      const source = await tx.knowledgeSource.create({
        data: {
          id: sourceId,
          account_id: account.id,
          bootstrap_id: bootstrap.id,
          source_type: "manual_reference",
          url: sourceUrl,
          normalized_url: sourceUrl,
          status: "acquired",
          robots_decision: "not_applicable",
          content_type: "text/plain",
          content_hash: sourceContentHash,
          extracted_text: input.evidenceNote,
          fetched_at: now,
          expires_at: null,
        },
      });
      const fact = await tx.knowledgeFact.create({
        data: {
          account_id: account.id,
          bootstrap_id: bootstrap.id,
          source_id: source.id,
          source_ids_json: [source.id],
          source_evidence_json: [{
            sourceId: source.id,
            sourceUrl,
            contentHash: sourceContentHash,
            evidenceExcerptHash,
            fetchedAt: now.toISOString(),
          }],
          fact_key: input.key,
          value_json: input.value as never,
          evidence_excerpt: input.evidenceNote,
          status,
          confidence: null,
          valid_as_of: validAsOf,
          reviewed_by: reviewed ? operator.data.user.id : null,
          reviewed_at: reviewed ? now : null,
          expires_at: null,
        },
      });
      await tx.auditLog.create({
        data: {
          account_id: account.id,
          actor_user_id: operator.data.user.id,
          actor_type: "user",
          actor_role: operator.data.user.role,
          action: "client_environment.discovery_finding_recorded",
          category: "workflow",
          target_type: "KnowledgeFact",
          target_id: fact.id,
          reason: "Operator recorded structured discovery evidence against the existing tenant.",
          metadata_json: {
            bootstrapId: bootstrap.id,
            authority: input.authority,
            factKey: input.key,
            assessmentReportId: input.assessmentReportId ?? null,
            reviewRequired: !reviewed,
          },
          expires_at: auditExpiry(now),
        },
      });
      return { source, fact };
    });

    return ok(created);
  } catch (error) {
    return errFromThrown(error);
  }
}

export async function reviewDiscoveryFinding(params: {
  factId: string;
  input: unknown;
}, now = new Date()) {
  const operator = await requireOperator();
  if (!operator.ok) return operator;
  if (!db) return err("no_database", "Discovery review requires DATABASE_URL.");

  const parsed = DiscoveryFindingReviewSchema.safeParse(params.input);
  if (!parsed.success) return err("invalid_discovery_review", "Discovery review input is invalid.");

  try {
    const fact = await db.knowledgeFact.findUnique({ where: { id: params.factId } });
    if (!fact) return err("not_found", "Discovery finding was not found.");
    const [source, bootstrap] = await Promise.all([
      db.knowledgeSource.findFirst({
        where: {
          id: fact.source_id,
          account_id: fact.account_id,
          bootstrap_id: fact.bootstrap_id,
          source_type: "manual_reference",
        },
      }),
      db.prospectBootstrap.findFirst({
        where: { id: fact.bootstrap_id, account_id: fact.account_id, status: "converted" },
      }),
    ]);
    if (!source || !bootstrap) {
      return err("discovery_finding_out_of_scope", "Only findings attached to a promoted client environment may be reviewed here.");
    }

    const updated = await db.$transaction(async (tx) => {
      const reviewed = await tx.knowledgeFact.update({
        where: { id: fact.id },
        data: {
          status: parsed.data.decision,
          reviewed_by: operator.data.user.id,
          reviewed_at: now,
          conflict_group: parsed.data.decision === "rejected" ? fact.conflict_group : null,
        },
      });
      await tx.auditLog.create({
        data: {
          account_id: fact.account_id,
          actor_user_id: operator.data.user.id,
          actor_type: "user",
          actor_role: operator.data.user.role,
          action: "client_environment.discovery_finding_reviewed",
          category: "workflow",
          target_type: "KnowledgeFact",
          target_id: fact.id,
          reason: "Operator reviewed a structured discovery finding.",
          metadata_json: {
            bootstrapId: fact.bootstrap_id,
            factKey: fact.fact_key,
            decision: parsed.data.decision,
          },
          expires_at: auditExpiry(now),
        },
      });
      return reviewed;
    });

    return ok(updated);
  } catch (error) {
    return errFromThrown(error);
  }
}

export async function compileDiscoverySnapshot(params: {
  accountId: string;
  reviewAcknowledged: boolean;
}, now = new Date()) {
  const operator = await requireOperator();
  if (!operator.ok) return operator;
  if (params.reviewAcknowledged !== true) {
    return err("review_acknowledgment_required", "Review the discovery findings and current business context before compiling a new snapshot.");
  }
  if (!db) return err("no_database", "Discovery snapshot compilation requires DATABASE_URL.");

  try {
    const bootstrap = await db.prospectBootstrap.findFirst({
      where: { account_id: params.accountId, status: "converted" },
      orderBy: { converted_at: "desc" },
    });
    if (!bootstrap) return err("discovery_bootstrap_missing", "No promoted client environment exists for this tenant.");

    const [facts, sources, latest] = await Promise.all([
      db.knowledgeFact.findMany({ where: { account_id: params.accountId, bootstrap_id: bootstrap.id } }),
      db.knowledgeSource.findMany({ where: { account_id: params.accountId, bootstrap_id: bootstrap.id } }),
      db.businessMemorySnapshot.findFirst({
        where: { account_id: params.accountId, bootstrap_id: bootstrap.id },
        orderBy: { version: "desc" },
      }),
    ]);
    const approved = facts.filter((fact) => APPROVED_FACT_STATUSES.includes(fact.status as never));
    if (approved.length === 0) return err("no_approved_facts", "At least one approved fact is required to compile business context.");

    const compiled = compileBusinessMemorySnapshot({
      bootstrapId: bootstrap.id,
      accountId: params.accountId,
      facts,
      sources,
      generatedAt: now,
      unknowns: [
        ...PROSPECT_MEMORY_UNKNOWNS,
        "Live integrations remain disabled until a separately authorized live-use gate is completed.",
      ],
    });

    const result = await db.$transaction(async (tx) => {
      const snapshot = await tx.businessMemorySnapshot.create({
        data: {
          account_id: params.accountId,
          bootstrap_id: bootstrap.id,
          schema_version: compiled.memory.schemaVersion,
          version: (latest?.version ?? 0) + 1,
          memory_json: compiled.memory as never,
          content_hash: compiled.hash,
          template_version: PROSPECT_AGENT_TEMPLATE_VERSION,
          status: "approved",
          approved_by: operator.data.user.id,
          approved_at: now,
        },
      });
      await tx.prospectBootstrap.update({
        where: { id: bootstrap.id },
        data: { current_memory_snapshot_id: snapshot.id },
      });
      await tx.auditLog.create({
        data: {
          account_id: params.accountId,
          actor_user_id: operator.data.user.id,
          actor_type: "user",
          actor_role: operator.data.user.role,
          action: "client_environment.snapshot_compiled",
          category: "workflow",
          target_type: "BusinessMemorySnapshot",
          target_id: snapshot.id,
          reason: "Operator compiled a new immutable context snapshot after discovery enrichment.",
          metadata_json: {
            bootstrapId: bootstrap.id,
            snapshotHash: compiled.hash,
            version: snapshot.version,
            approvedFactCount: approved.length,
            liveActivationAuthorized: false,
          },
          expires_at: auditExpiry(now),
        },
      });
      return snapshot;
    });

    return ok({ snapshot: result, memory: compiled.memory });
  } catch (error) {
    return errFromThrown(error);
  }
}

export async function buildClientEnvironmentManifest(accountId: string, now = new Date()) {
  const operator = await requireOperator();
  if (!operator.ok) return operator;
  if (!db) return err("no_database", "Client-environment manifests require DATABASE_URL.");

  try {
    const [account, bootstrap] = await Promise.all([
      db.account.findUnique({ where: { id: accountId } }),
      db.prospectBootstrap.findFirst({
        where: { account_id: accountId, status: "converted" },
        orderBy: { converted_at: "desc" },
      }),
    ]);
    if (!account || !bootstrap || !bootstrap.current_memory_snapshot_id) {
      return err("client_environment_not_ready", "Promote the completed demo and compile an approved snapshot first.");
    }

    const discoverySourceRows = await db.knowledgeSource.findMany({
      where: { account_id: account.id, bootstrap_id: bootstrap.id, source_type: "manual_reference" },
      select: { id: true },
    });
    const discoverySourceIds = discoverySourceRows.map(({ id }) => id);

    const [snapshot, profile, approvedFindings, pendingFindings, assessments] = await Promise.all([
      db.businessMemorySnapshot.findFirst({
        where: {
          id: bootstrap.current_memory_snapshot_id,
          account_id: account.id,
          bootstrap_id: bootstrap.id,
          status: "approved",
        },
      }),
      db.agentProfile.findFirst({ where: { account_id: account.id, type: "demo_mode", is_default: true } }),
      db.knowledgeFact.count({
        where: {
          account_id: account.id,
          bootstrap_id: bootstrap.id,
          status: { in: [...APPROVED_FACT_STATUSES] },
          source_id: { in: discoverySourceIds },
        },
      }),
      db.knowledgeFact.count({
        where: {
          account_id: account.id,
          bootstrap_id: bootstrap.id,
          status: { in: [...PENDING_FACT_STATUSES] },
          source_id: { in: discoverySourceIds },
        },
      }),
      db.assessmentReport.findMany({
        where: { account_id: account.id },
        select: { id: true },
        orderBy: { created_at: "asc" },
      }),
    ]);
    if (!snapshot || !profile) return err("client_environment_incomplete", "The current snapshot or agent profile is missing.");

    const memory = BusinessMemorySnapshotSchema.parse(snapshot.memory_json);
    if (memory.accountId !== account.id || memory.bootstrapId !== bootstrap.id) {
      return err("client_environment_identity_mismatch", "The current memory snapshot is not bound to this tenant.");
    }

    const manifest: ClientEnvironmentManifest = ClientEnvironmentManifestSchema.parse({
      schemaVersion: CLIENT_ENVIRONMENT_SCHEMA_VERSION,
      templateVersion: CLIENT_ENVIRONMENT_TEMPLATE_VERSION,
      generatedAt: now.toISOString(),
      accountId: account.id,
      sourceBootstrapId: bootstrap.id,
      lifecycleStage: "discovery",
      businessIdentity: {
        name: account.name,
        canonicalWebsite: bootstrap.canonical_website,
        industry: account.industry,
        timezone: account.timezone,
      },
      context: {
        snapshotId: snapshot.id,
        snapshotHash: snapshot.content_hash,
        snapshotVersion: snapshot.version,
        memory,
      },
      discovery: {
        assessmentReportIds: assessments.map(({ id }) => id),
        discoverySourceCount: discoverySourceIds.length,
        approvedFindingCount: approvedFindings,
        pendingFindingCount: pendingFindings,
      },
      agent: {
        templateVersion: PROSPECT_AGENT_TEMPLATE_VERSION,
        policyHash: contentHash(profile.system_policy_json ?? {}),
        executionMode: "DISCOVERY_PREVIEW",
        liveActivationAuthorized: false,
      },
      integrations: {
        telephony: "review_required",
        crm: "disabled",
        scheduling: "disabled",
        payments: "disabled",
      },
      promotion: {
        tenantIdentityPreserved: true,
        requiresSeparateLiveGate: true,
      },
    });

    return ok(manifest);
  } catch (error) {
    return errFromThrown(error);
  }
}
