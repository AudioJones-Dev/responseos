import "@/lib/serverOnlyGuard";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db/client";
import { getCurrentSession } from "@/lib/auth/session";
import { isCrossTenantRole, withTenantScope } from "@/lib/data/session-helpers";
import { err, errFromThrown, ok, type Result } from "@/lib/data/result";
import { acquireProspectWebsite } from "./websiteAcquisition";
import { extractObservedFacts } from "./factExtraction";
import {
  PROSPECT_ACTIVE_DAYS,
  PROSPECT_AGENT_TEMPLATE_VERSION,
  PROSPECT_AUDIT_RETENTION_DAYS,
  PROSPECT_CONTENT_RETENTION_DAYS,
  PROSPECT_NUMBER_QUARANTINE_DAYS,
  PROSPECT_REVIEW_DAYS,
  PROSPECT_MEMORY_UNKNOWNS,
  BusinessMemorySnapshotSchema,
  type KnowledgeFactStatus,
  type ProspectBootstrapStatus,
} from "./contracts";
import { PROSPECT_DEMO_POLICY } from "./policy";
import { verifyProspectProviderAttestation } from "./attestation";
import { assertProspectBootstrapTransition, isTerminalProspectBootstrapStatus } from "./lifecycle";
import { compileBusinessMemorySnapshot, compileProspectAgentContext, contentHash, stableJson } from "./memory";
import { buildPromotionManifest, validatePromotionManifest } from "./promotion";

const DAY_MS = 24 * 60 * 60 * 1000;
const APPROVED_FACT_STATUSES = ["operator_approved_for_demo", "owner_confirmed"] as const;
const MULTI_VALUE_FACT_KEYS = new Set([
  "contact.phone",
  "contact.email",
  "operating_hours.statement",
  "service.statement",
  "service_area.statement",
  "policy.statement",
  "location.statement",
]);

export interface ProspectBootstrapListItem {
  id: string;
  account_id: string;
  account_name: string;
  canonical_website: string;
  status: ProspectBootstrapStatus;
  current_memory_snapshot_id?: string;
  active_assignment_id?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function slugify(value: string): string {
  const base = value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 48);
  return `${base || "prospect"}-${randomUUID().slice(0, 8)}`;
}

export function normalizeE164(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  throw new Error("invalid_e164");
}

async function requireOperator() {
  const session = await getCurrentSession();
  if (!session) return err("no_session", "No active session.");
  if (!isCrossTenantRole(session)) return err("role_denied", "Operator access is required.");
  return ok(session);
}

function auditData(params: {
  accountId?: string;
  actorUserId?: string;
  actorRole?: "aj_admin" | "operator" | "client_admin" | "client_viewer";
  action: string;
  targetType: string;
  targetId: string;
  reason: string;
  metadata?: Record<string, unknown>;
}) {
  return {
    account_id: params.accountId ?? null,
    actor_user_id: params.actorUserId ?? null,
    actor_type: "user" as const,
    actor_role: params.actorRole ?? null,
    action: params.action,
    category: "workflow" as const,
    target_type: params.targetType,
    target_id: params.targetId,
    reason: params.reason,
    metadata_json: (params.metadata ?? null) as never,
    expires_at: addDays(new Date(), PROSPECT_AUDIT_RETENTION_DAYS),
  };
}

function mapListItem(row: {
  id: string;
  account_id: string;
  canonical_website: string;
  status: string;
  current_memory_snapshot_id: string | null;
  active_assignment_id: string | null;
  expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
}, accountName: string): ProspectBootstrapListItem {
  return {
    id: row.id,
    account_id: row.account_id,
    account_name: accountName,
    canonical_website: row.canonical_website,
    status: row.status as ProspectBootstrapStatus,
    current_memory_snapshot_id: row.current_memory_snapshot_id ?? undefined,
    active_assignment_id: row.active_assignment_id ?? undefined,
    expires_at: row.expires_at?.toISOString(),
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export async function listProspectBootstraps(params: { accountId?: string } = {}): Promise<Result<ProspectBootstrapListItem[]>> {
  const scope = await withTenantScope(params.accountId);
  if (!scope.ok) return err(scope.error.code, scope.error.message);
  if (!db) return ok([]);
  try {
    const rows = await db.prospectBootstrap.findMany({
      where: scope.effectiveAccountId ? { account_id: scope.effectiveAccountId } : {},
      orderBy: { created_at: "desc" },
    });
    const accounts = await db.account.findMany({
      where: { id: { in: rows.map((row) => row.account_id) } },
      select: { id: true, name: true },
    });
    const names = new Map(accounts.map((account) => [account.id, account.name]));
    return ok(rows.map((row) => mapListItem(row, names.get(row.account_id) ?? "Unknown account")));
  } catch (error) {
    return errFromThrown(error);
  }
}

export async function getProspectBootstrapDetail(id: string) {
  const operator = await requireOperator();
  if (!operator.ok) return operator;
  if (!db) return err("no_database", "Prospect bootstraps require DATABASE_URL.");
  try {
    const bootstrap = await db.prospectBootstrap.findUnique({ where: { id } });
    if (!bootstrap) return err("not_found", "Prospect bootstrap was not found.");
    const [account, sources, facts, snapshots, assignments, promotions] = await Promise.all([
      db.account.findUnique({ where: { id: bootstrap.account_id } }),
      db.knowledgeSource.findMany({ where: { account_id: bootstrap.account_id, bootstrap_id: id }, orderBy: { normalized_url: "asc" } }),
      db.knowledgeFact.findMany({ where: { account_id: bootstrap.account_id, bootstrap_id: id }, orderBy: [{ fact_key: "asc" }, { created_at: "asc" }] }),
      db.businessMemorySnapshot.findMany({ where: { account_id: bootstrap.account_id, bootstrap_id: id }, orderBy: { version: "desc" } }),
      db.telephonyNumberAssignment.findMany({ where: { account_id: bootstrap.account_id, bootstrap_id: id }, orderBy: { assigned_at: "desc" } }),
      db.bootstrapPromotion.findMany({ where: { account_id: bootstrap.account_id, bootstrap_id: id }, orderBy: { created_at: "desc" } }),
    ]);
    const numbers = await db.telephonyNumber.findMany({
      where: { id: { in: assignments.map((assignment) => assignment.telephony_number_id) } },
    });
    return ok({ bootstrap, account, sources, facts, snapshots, assignments, promotions, numbers });
  } catch (error) {
    return errFromThrown(error);
  }
}

export async function createProspectBootstrap(params: {
  businessName: string;
  canonicalWebsite: string;
  timezone?: string;
  prospectIntakeId?: string;
}) {
  const operator = await requireOperator();
  if (!operator.ok) return operator;
  if (!db) return err("no_database", "Prospect bootstraps require DATABASE_URL.");
  let canonicalWebsite: string;
  try {
    const url = new URL(params.canonicalWebsite);
    if (url.protocol !== "https:" || url.username || url.password) throw new Error();
    url.hash = "";
    canonicalWebsite = url.toString();
  } catch {
    return err("invalid_website", "A public HTTPS website is required.");
  }
  try {
    const created = await db.$transaction(async (tx) => {
      const account = await tx.account.create({
        data: {
          name: params.businessName.trim(),
          slug: slugify(params.businessName),
          industry: "home-services",
          website_url: canonicalWebsite,
          timezone: params.timezone ?? "America/New_York",
          status: "lead",
          account_type: "sandbox",
        },
      });
      const bootstrap = await tx.prospectBootstrap.create({
        data: {
          account_id: account.id,
          prospect_intake_id: params.prospectIntakeId,
          canonical_website: canonicalWebsite,
          active_account_key: account.id,
          review_expires_at: addDays(new Date(), PROSPECT_REVIEW_DAYS),
        },
      });
      await tx.agentProfile.create({
        data: {
          account_id: account.id,
          name: `${account.name} Prospect Demo`,
          slug: "prospect-demo",
          type: "demo_mode",
          enabled: false,
          is_default: true,
          system_policy_json: PROSPECT_DEMO_POLICY as never,
          metadata_json: {
            bootstrapId: bootstrap.id,
            templateVersion: PROSPECT_AGENT_TEMPLATE_VERSION,
          },
        },
      });
      await tx.auditLog.create({ data: auditData({
        accountId: account.id,
        actorUserId: operator.data.user.id,
        actorRole: operator.data.user.role,
        action: "prospect_bootstrap.created",
        targetType: "ProspectBootstrap",
        targetId: bootstrap.id,
        reason: "Operator created an isolated prospect demo workspace.",
        metadata: { executionMode: "PROSPECT_DEMO", industry: "home-services" },
      }) });
      return { account, bootstrap };
    });
    return ok(created);
  } catch (error) {
    return errFromThrown(error);
  }
}

export async function ingestProspectBootstrap(params: {
  bootstrapId: string;
  approvedSameSiteUrls?: string[];
  fetchFn?: typeof fetch;
  lookupFn?: (hostname: string) => Promise<Array<{ address: string; family: number }>>;
  now?: Date;
}) {
  const operator = await requireOperator();
  if (!operator.ok) return operator;
  if (!db) return err("no_database", "Prospect bootstraps require DATABASE_URL.");
  const now = params.now ?? new Date();
  const bootstrap = await db.prospectBootstrap.findUnique({ where: { id: params.bootstrapId } });
  if (!bootstrap) return err("not_found", "Prospect bootstrap was not found.");
  try {
    assertProspectBootstrapTransition(bootstrap.status as ProspectBootstrapStatus, "ingesting");
  } catch {
    return err("invalid_transition", `Cannot ingest a bootstrap in ${bootstrap.status}.`);
  }
  const run = await db.$transaction(async (tx) => {
    await tx.prospectBootstrap.update({ where: { id: bootstrap.id }, data: {
      status: "ingesting",
      review_expires_at: addDays(now, PROSPECT_REVIEW_DAYS),
    } });
    const createdRun = await tx.knowledgeIngestionRun.create({ data: {
      account_id: bootstrap.account_id,
      bootstrap_id: bootstrap.id,
      status: "running",
      extractor_version: "deterministic-public-web.v1",
      template_version: PROSPECT_AGENT_TEMPLATE_VERSION,
      started_at: now,
    } });
    await tx.auditLog.create({ data: auditData({
      accountId: bootstrap.account_id,
      actorUserId: operator.data.user.id,
      actorRole: operator.data.user.role,
      action: "prospect_bootstrap.ingestion_started",
      targetType: "KnowledgeIngestionRun",
      targetId: createdRun.id,
      reason: "Operator started bounded public-website acquisition.",
    }) });
    return createdRun;
  });
  try {
    const acquisition = await acquireProspectWebsite({
      canonicalUrl: bootstrap.canonical_website,
      approvedSameSiteUrls: params.approvedSameSiteUrls,
      fetchFn: params.fetchFn,
      lookupFn: params.lookupFn,
      now,
    });
    if (acquisition.pages.length === 0) throw new Error("website_no_eligible_pages");
    const observedFacts = extractObservedFacts(acquisition.pages);
    const completed = await db.$transaction(async (tx) => {
      const sourceIds = new Map<string, string>();
      const expiresAt = addDays(now, PROSPECT_CONTENT_RETENTION_DAYS);
      for (const page of acquisition.pages) {
        const source = await tx.knowledgeSource.upsert({
          where: { bootstrap_id_normalized_url: { bootstrap_id: bootstrap.id, normalized_url: page.normalizedUrl } },
          create: {
            account_id: bootstrap.account_id,
            bootstrap_id: bootstrap.id,
            ingestion_run_id: run.id,
            source_type: "website_page",
            url: page.url,
            normalized_url: page.normalizedUrl,
            status: "acquired",
            robots_decision: "allowed",
            http_status: page.httpStatus,
            content_type: page.contentType,
            content_hash: page.contentHash,
            extracted_text: page.extractedText,
            fetched_at: now,
            expires_at: expiresAt,
          },
          update: {
            ingestion_run_id: run.id,
            status: "acquired",
            robots_decision: "allowed",
            http_status: page.httpStatus,
            content_type: page.contentType,
            content_hash: page.contentHash,
            extracted_text: page.extractedText,
            fetched_at: now,
            expires_at: expiresAt,
            purged_at: null,
          },
        });
        sourceIds.set(page.normalizedUrl, source.id);
      }
      await tx.knowledgeFact.deleteMany({ where: {
        account_id: bootstrap.account_id,
        bootstrap_id: bootstrap.id,
        status: { notIn: [...APPROVED_FACT_STATUSES] },
      } });
      const grouped = new Map<string, Set<string>>();
      const collapsed = new Map<string, {
        fact: (typeof observedFacts)[number];
        sourceEvidence: Map<string, string>;
      }>();
      for (const fact of observedFacts) {
        const serialized = JSON.stringify(fact.value);
        const values = grouped.get(fact.key) ?? new Set<string>();
        values.add(serialized);
        grouped.set(fact.key, values);
        const signature = `${fact.key}:${serialized}`;
        const existing = collapsed.get(signature) ?? { fact, sourceEvidence: new Map<string, string>() };
        existing.sourceEvidence.set(fact.sourceUrl, fact.evidenceExcerpt);
        collapsed.set(signature, existing);
      }
      let conflictCount = 0;
      const acquiredPageByUrl = new Map(acquisition.pages.map((page) => [page.normalizedUrl, page]));
      for (const { fact, sourceEvidence } of collapsed.values()) {
        const conflicting = !MULTI_VALUE_FACT_KEYS.has(fact.key) && (grouped.get(fact.key)?.size ?? 0) > 1;
        if (conflicting) conflictCount += 1;
        const factSourceIds = [...sourceEvidence.keys()].map((url) => sourceIds.get(url)).filter((value): value is string => Boolean(value));
        const sourceId = factSourceIds[0];
        if (!sourceId) continue;
        await tx.knowledgeFact.create({ data: {
          account_id: bootstrap.account_id,
          bootstrap_id: bootstrap.id,
          source_id: sourceId,
          source_ids_json: factSourceIds,
          source_evidence_json: [...sourceEvidence.entries()].flatMap(([sourceUrl, evidenceExcerpt]) => {
            const linkedSourceId = sourceIds.get(sourceUrl);
            const page = acquiredPageByUrl.get(sourceUrl);
            if (!linkedSourceId || !page) return [];
            return [{
              sourceId: linkedSourceId,
              sourceUrl,
              contentHash: page.contentHash,
              evidenceExcerptHash: contentHash(evidenceExcerpt),
              fetchedAt: page.fetchedAt,
            }];
          }),
          fact_key: fact.key,
          value_json: fact.value as never,
          evidence_excerpt: fact.evidenceExcerpt,
          status: conflicting ? "conflicted" : factSourceIds.length > 1 ? "cross_source_confirmed" : "source_observed",
          confidence: fact.confidence,
          conflict_group: conflicting ? `conflict:${fact.key}` : null,
          valid_as_of: now,
          expires_at: expiresAt,
        } });
      }
      await tx.knowledgeIngestionRun.update({ where: { id: run.id }, data: {
        status: "completed",
        source_count: acquisition.pages.length,
        fact_count: collapsed.size,
        conflict_count: conflictCount,
        ended_at: now,
      } });
      const updated = await tx.prospectBootstrap.update({ where: { id: bootstrap.id }, data: {
        status: "review_required",
        review_expires_at: addDays(now, PROSPECT_REVIEW_DAYS),
      } });
      await tx.auditLog.create({ data: auditData({
        accountId: bootstrap.account_id,
        actorUserId: operator.data.user.id,
        actorRole: operator.data.user.role,
        action: "prospect_bootstrap.ingestion_completed",
        targetType: "ProspectBootstrap",
        targetId: bootstrap.id,
        reason: "Bounded public website acquisition completed and requires human review.",
        metadata: { sourceCount: acquisition.pages.length, factCount: collapsed.size, conflictCount },
      }) });
      return updated;
    });
    return ok({ bootstrap: completed, acquisition });
  } catch (error) {
    const code = error instanceof Error ? error.message.slice(0, 120) : "website_acquisition_failed";
    await db.$transaction(async (tx) => {
      await tx.knowledgeIngestionRun.update({ where: { id: run.id }, data: { status: "failed", error_code: code, error_redacted: "Website acquisition failed.", ended_at: new Date() } });
      await tx.prospectBootstrap.update({ where: { id: bootstrap.id }, data: {
        status: "failed",
        review_expires_at: addDays(new Date(), PROSPECT_REVIEW_DAYS),
      } });
      await tx.auditLog.create({ data: auditData({
        accountId: bootstrap.account_id,
        actorUserId: operator.data.user.id,
        actorRole: operator.data.user.role,
        action: "prospect_bootstrap.ingestion_failed",
        targetType: "KnowledgeIngestionRun",
        targetId: run.id,
        reason: "Bounded website acquisition failed and requires operator review.",
        metadata: { errorCode: code },
      }) });
    });
    return err("ingestion_failed", "Website acquisition failed. Review the source and retry.");
  }
}

export async function reviewKnowledgeFact(params: { factId: string; status: KnowledgeFactStatus }) {
  const operator = await requireOperator();
  if (!operator.ok) return operator;
  if (!db) return err("no_database", "Knowledge review requires DATABASE_URL.");
  if (![...APPROVED_FACT_STATUSES, "rejected"].includes(params.status as never)) {
    return err("invalid_review_status", "A fact may only be approved, owner-confirmed, or rejected by review.");
  }
  try {
    const existing = await db.knowledgeFact.findUnique({ where: { id: params.factId } });
    if (!existing) return err("not_found", "Knowledge fact was not found.");
    const fact = await db.$transaction(async (tx) => {
      if (params.status !== "rejected" && existing.conflict_group) {
        await tx.knowledgeFact.updateMany({
          where: {
            account_id: existing.account_id,
            bootstrap_id: existing.bootstrap_id,
            conflict_group: existing.conflict_group,
            id: { not: existing.id },
          },
          data: {
            status: "rejected",
            reviewed_by: operator.data.user.id,
            reviewed_at: new Date(),
          },
        });
      }
      const updated = await tx.knowledgeFact.update({ where: { id: existing.id }, data: {
        status: params.status,
        conflict_group: params.status === "rejected" ? existing.conflict_group : null,
        reviewed_by: operator.data.user.id,
        reviewed_at: new Date(),
      } });
      await tx.auditLog.create({ data: auditData({
        accountId: existing.account_id,
        actorUserId: operator.data.user.id,
        actorRole: operator.data.user.role,
        action: "prospect_bootstrap.fact_reviewed",
        targetType: "KnowledgeFact",
        targetId: existing.id,
        reason: "Operator reviewed a public-source fact for demo eligibility.",
        metadata: { factKey: existing.fact_key, decision: params.status },
      }) });
      return updated;
    });
    return ok(fact);
  } catch (error) {
    return errFromThrown(error);
  }
}

export async function createManualKnowledgeFact(params: {
  bootstrapId: string;
  sourceId: string;
  factKey: string;
  value: string;
  evidenceExcerpt: string;
}) {
  const operator = await requireOperator();
  if (!operator.ok) return operator;
  if (!db) return err("no_database", "Manual fact entry requires DATABASE_URL.");
  const factKey = params.factKey.trim();
  const value = params.value.trim();
  const evidenceExcerpt = params.evidenceExcerpt.trim();
  if (!/^[a-z][a-z0-9_.-]{2,79}$/.test(factKey)) {
    return err("invalid_fact_key", "Fact key must be 3-80 lowercase letters, digits, dots, underscores, or hyphens.");
  }
  if (!value || value.length > 2_000) return err("invalid_fact_value", "Fact value must be 1-2000 characters.");
  if (!evidenceExcerpt || evidenceExcerpt.length > 500) return err("invalid_evidence", "Evidence excerpt must be 1-500 characters.");
  try {
    const bootstrap = await db.prospectBootstrap.findUnique({ where: { id: params.bootstrapId } });
    if (!bootstrap || bootstrap.status !== "review_required") return err("bootstrap_not_in_review", "Manual facts may only be added during review.");
    const source = await db.knowledgeSource.findFirst({ where: {
      id: params.sourceId,
      account_id: bootstrap.account_id,
      bootstrap_id: bootstrap.id,
      status: "acquired",
    } });
    if (!source?.extracted_text || !source.content_hash || !source.fetched_at) {
      return err("source_unavailable", "The selected acquired source is unavailable.");
    }
    if (!source.extracted_text.includes(evidenceExcerpt)) {
      return err("evidence_not_in_source", "The evidence excerpt must exactly match text in the selected source.");
    }
    const fetchedAt = source.fetched_at;
    const fact = await db.$transaction(async (tx) => {
      const created = await tx.knowledgeFact.create({ data: {
        account_id: bootstrap.account_id,
        bootstrap_id: bootstrap.id,
        source_id: source.id,
        source_ids_json: [source.id],
        source_evidence_json: [{
          sourceId: source.id,
          sourceUrl: source.normalized_url,
          contentHash: source.content_hash,
          evidenceExcerptHash: contentHash(evidenceExcerpt),
          fetchedAt: fetchedAt.toISOString(),
        }],
        fact_key: factKey,
        value_json: value,
        evidence_excerpt: evidenceExcerpt,
        status: "source_observed",
        confidence: null,
        valid_as_of: fetchedAt,
        expires_at: source.expires_at,
      } });
      await tx.auditLog.create({ data: auditData({
        accountId: bootstrap.account_id,
        actorUserId: operator.data.user.id,
        actorRole: operator.data.user.role,
        action: "prospect_bootstrap.fact_created_from_source",
        targetType: "KnowledgeFact",
        targetId: created.id,
        reason: "Operator created a reviewable fact tied to exact acquired-source evidence.",
        metadata: { factKey, sourceId: source.id },
      }) });
      return created;
    });
    return ok(fact);
  } catch (error) {
    return errFromThrown(error);
  }
}

export async function createAndApproveMemorySnapshot(params: { bootstrapId: string; reviewAcknowledged: boolean }) {
  const operator = await requireOperator();
  if (!operator.ok) return operator;
  if (!db) return err("no_database", "Memory approval requires DATABASE_URL.");
  try {
    if (params.reviewAcknowledged !== true) return err("review_acknowledgment_required", "Confirm the sources, facts, unknowns, conflicts, instructions, number state, and action boundaries before approval.");
    const bootstrap = await db.prospectBootstrap.findUnique({ where: { id: params.bootstrapId } });
    if (!bootstrap) return err("not_found", "Prospect bootstrap was not found.");
    if (bootstrap.status !== "review_required") return err("invalid_transition", "Bootstrap is not awaiting review.");
    const [facts, sources, latest] = await Promise.all([
      db.knowledgeFact.findMany({ where: { account_id: bootstrap.account_id, bootstrap_id: bootstrap.id } }),
      db.knowledgeSource.findMany({ where: { account_id: bootstrap.account_id, bootstrap_id: bootstrap.id, status: "acquired" } }),
      db.businessMemorySnapshot.findFirst({ where: { bootstrap_id: bootstrap.id }, orderBy: { version: "desc" } }),
    ]);
    const approved = facts.filter((fact) => APPROVED_FACT_STATUSES.includes(fact.status as never));
    if (approved.length === 0) return err("no_approved_facts", "Approve at least one sourced fact before creating a snapshot.");
    const compiled = compileBusinessMemorySnapshot({
      bootstrapId: bootstrap.id,
      accountId: bootstrap.account_id,
      facts,
      sources,
      unknowns: [...PROSPECT_MEMORY_UNKNOWNS],
    });
    const approvedAt = new Date();
    const result = await db.$transaction(async (tx) => {
      const snapshot = await tx.businessMemorySnapshot.create({ data: {
        account_id: bootstrap.account_id,
        bootstrap_id: bootstrap.id,
        schema_version: compiled.memory.schemaVersion,
        version: (latest?.version ?? 0) + 1,
        memory_json: compiled.memory as never,
        content_hash: compiled.hash,
        template_version: PROSPECT_AGENT_TEMPLATE_VERSION,
        status: "approved",
        approved_by: operator.data.user.id,
        approved_at: approvedAt,
      } });
      const updated = await tx.prospectBootstrap.update({ where: { id: bootstrap.id }, data: {
        status: "approved",
        current_memory_snapshot_id: snapshot.id,
        approved_by: operator.data.user.id,
        approved_at: approvedAt,
        review_expires_at: addDays(approvedAt, PROSPECT_REVIEW_DAYS),
        content_expires_at: addDays(approvedAt, PROSPECT_CONTENT_RETENTION_DAYS),
      } });
      await tx.auditLog.create({ data: auditData({
        accountId: bootstrap.account_id,
        actorUserId: operator.data.user.id,
        actorRole: operator.data.user.role,
        action: "prospect_bootstrap.snapshot_approved",
        targetType: "BusinessMemorySnapshot",
        targetId: snapshot.id,
        reason: "Operator approved an immutable prospect demo memory snapshot.",
        metadata: {
          snapshotHash: compiled.hash,
          approvedFactCount: approved.length,
          version: snapshot.version,
          reviewAcknowledged: true,
        },
      }) });
      return { bootstrap: updated, snapshot };
    });
    return ok(result);
  } catch (error) {
    return errFromThrown(error);
  }
}

export async function registerTelephonyNumber(params: {
  providerNumberId: string;
  e164: string;
  providerAttestation: unknown;
  evergreen?: boolean;
  monthlyCostMicros?: number;
}, now = new Date()) {
  const operator = await requireOperator();
  if (!operator.ok) return operator;
  if (!db) return err("no_database", "Number inventory requires DATABASE_URL.");
  try {
    const e164 = normalizeE164(params.e164);
    const providerAttestation = verifyProspectProviderAttestation({
      value: params.providerAttestation,
      providerNumberId: params.providerNumberId,
      e164,
      publicKey: process.env.RESPONSEOS_PROVIDER_ATTESTATION_PUBLIC_KEY,
      now,
    });
    const number = await db.$transaction(async (tx) => {
      const created = await tx.telephonyNumber.create({ data: {
        provider: "telnyx",
        provider_number_id: params.providerNumberId,
        e164,
        status: "available",
        monthly_cost_micros: params.monthlyCostMicros,
        evergreen: params.evergreen ?? false,
        acquired_at: new Date(),
        capabilities_json: { voice: true, providerAttestation },
      } });
      await tx.auditLog.create({ data: auditData({
        actorUserId: operator.data.user.id,
        actorRole: operator.data.user.role,
        action: "prospect_bootstrap.number_registered",
        targetType: "TelephonyNumber",
        targetId: created.id,
        reason: "Operator registered an already-provisioned Telnyx number in the demo inventory.",
        metadata: { provider: "telnyx", e164, evergreen: created.evergreen },
      }) });
      return created;
    });
    return ok(number);
  } catch (error) {
    return errFromThrown(error);
  }
}

function verifyStoredNumberAttestation(number: {
  provider_number_id: string;
  e164: string;
  capabilities_json: unknown;
}, now = new Date()) {
  const capabilities = number.capabilities_json;
  if (!capabilities || typeof capabilities !== "object" || Array.isArray(capabilities)) {
    throw new Error("provider_attestation_missing");
  }
  return verifyProspectProviderAttestation({
    value: (capabilities as Record<string, unknown>).providerAttestation,
    providerNumberId: number.provider_number_id,
    e164: number.e164,
    publicKey: process.env.RESPONSEOS_PROVIDER_ATTESTATION_PUBLIC_KEY,
    now,
  });
}

export async function listAvailableTelephonyNumbers() {
  const operator = await requireOperator();
  if (!operator.ok) return operator;
  if (!db) return ok([]);
  try {
    return ok(await db.telephonyNumber.findMany({
      where: { provider: "telnyx", status: "available", evergreen: false },
      orderBy: { e164: "asc" },
    }));
  } catch (error) {
    return errFromThrown(error);
  }
}

export async function assignTelephonyNumber(params: { bootstrapId: string; telephonyNumberId: string }, now = new Date()) {
  const operator = await requireOperator();
  if (!operator.ok) return operator;
  if (!db) return err("no_database", "Number assignment requires DATABASE_URL.");
  try {
    const result = await db.$transaction(async (tx) => {
      const bootstrap = await tx.prospectBootstrap.findUnique({ where: { id: params.bootstrapId } });
      if (!bootstrap || bootstrap.status !== "approved" || !bootstrap.current_memory_snapshot_id) throw new Error("bootstrap_not_approved");
      const number = await tx.telephonyNumber.findUnique({ where: { id: params.telephonyNumberId } });
      if (!number || number.status !== "available" || number.evergreen) throw new Error("number_not_available");
      const providerAttestation = verifyStoredNumberAttestation(number, now);
      const assistantPreflight = providerAttestation.payload;
      await tx.prospectBootstrap.update({ where: { id: bootstrap.id }, data: { status: "provisioning" } });
      const assignment = await tx.telephonyNumberAssignment.create({ data: {
        account_id: bootstrap.account_id,
        bootstrap_id: bootstrap.id,
        telephony_number_id: number.id,
        provider_assistant_id: assistantPreflight.assistantId,
        status: "assigned",
        assigned_at: now,
        number_exclusivity_key: number.id,
        bootstrap_exclusivity_key: bootstrap.id,
      } });
      await tx.telephonyNumber.update({ where: { id: number.id }, data: { status: "assigned" } });
      const updated = await tx.prospectBootstrap.update({ where: { id: bootstrap.id }, data: {
        status: "ready",
        active_assignment_id: assignment.id,
        review_expires_at: null,
        expires_at: addDays(now, PROSPECT_ACTIVE_DAYS),
      } });
      await tx.auditLog.create({ data: auditData({
        accountId: bootstrap.account_id,
        actorUserId: operator.data.user.id,
        actorRole: operator.data.user.role,
        action: "prospect_bootstrap.number_assigned",
        targetType: "TelephonyNumberAssignment",
        targetId: assignment.id,
        reason: "Operator assigned one exclusive pool number to an approved prospect bootstrap.",
        metadata: { telephonyNumberId: number.id, providerAssistantId: assistantPreflight.assistantId, templateChecksum: assistantPreflight.templateChecksum },
      }) });
      return { bootstrap: updated, assignment, number };
    });
    return ok(result);
  } catch (error) {
    const code = error instanceof Error ? error.message : "number_assignment_failed";
    return err(code, "The number could not be assigned.");
  }
}

export async function activateProspectBootstrap(params: { bootstrapId: string; activationAcknowledged: boolean }, now = new Date()) {
  const operator = await requireOperator();
  if (!operator.ok) return operator;
  if (params.activationAcknowledged !== true) {
    return err("activation_acknowledgment_required", "Confirm the final number, attestation, snapshot, instructions, and action boundaries before activation.");
  }
  if (process.env.RESPONSEOS_PROSPECT_BOOTSTRAP_ENABLED !== "true") {
    return err("prospect_bootstrap_disabled", "Prospect bootstrap activation is disabled.");
  }
  if (!db) return err("no_database", "Activation requires DATABASE_URL.");
  try {
    const result = await db.$transaction(async (tx) => {
      const bootstrap = await tx.prospectBootstrap.findUnique({ where: { id: params.bootstrapId } });
      if (!bootstrap || bootstrap.status !== "ready" || !bootstrap.current_memory_snapshot_id || !bootstrap.active_assignment_id) throw new Error("bootstrap_not_ready");
      const [snapshot, assignment, profile] = await Promise.all([
        tx.businessMemorySnapshot.findUnique({ where: { id: bootstrap.current_memory_snapshot_id } }),
        tx.telephonyNumberAssignment.findUnique({ where: { id: bootstrap.active_assignment_id } }),
        tx.agentProfile.findFirst({ where: { account_id: bootstrap.account_id, type: "demo_mode", is_default: true } }),
      ]);
      if (!snapshot || snapshot.status !== "approved" || !assignment || assignment.status !== "assigned" || !profile) throw new Error("bootstrap_preflight_failed");
      const number = await tx.telephonyNumber.findUnique({ where: { id: assignment.telephony_number_id } });
      if (!number || number.status !== "assigned" || !assignment.provider_assistant_id) throw new Error("telephony_preflight_failed");
      const assistantPreflight = verifyStoredNumberAttestation(number, now).payload;
      if (assistantPreflight.assistantId !== assignment.provider_assistant_id) throw new Error("assistant_assignment_mismatch");
      if (stableJson(profile.system_policy_json) !== stableJson(PROSPECT_DEMO_POLICY)) throw new Error("policy_checksum_mismatch");
      const expiresAt = addDays(now, PROSPECT_ACTIVE_DAYS);
      const updatedAssignment = await tx.telephonyNumberAssignment.update({ where: { id: assignment.id }, data: { status: "active", activated_at: now } });
      const updated = await tx.prospectBootstrap.update({ where: { id: bootstrap.id }, data: {
        status: "active",
        activated_at: now,
        expires_at: expiresAt,
        content_expires_at: addDays(now, PROSPECT_CONTENT_RETENTION_DAYS),
      } });
      await tx.agentProfile.updateMany({ where: { account_id: bootstrap.account_id, type: "demo_mode" }, data: { enabled: true } });
      await tx.auditLog.create({ data: auditData({
        accountId: bootstrap.account_id,
        actorUserId: operator.data.user.id,
        actorRole: operator.data.user.role,
        action: "prospect_bootstrap.activated",
        targetType: "ProspectBootstrap",
        targetId: bootstrap.id,
        reason: "Operator activated a supervised inbound-only prospect demo.",
        metadata: {
          expiresAt: expiresAt.toISOString(),
          recordingEnabled: false,
          crmSyncEnabled: false,
          activationAcknowledged: true,
        },
      }) });
      return { bootstrap: updated, assignment: updatedAssignment };
    });
    return ok(result);
  } catch (error) {
    const code = error instanceof Error ? error.message : "activation_failed";
    return err(code, "Prospect bootstrap activation failed.");
  }
}

export async function completeProspectBootstrap(bootstrapId: string, now = new Date()) {
  const operator = await requireOperator();
  if (!operator.ok) return operator;
  if (!db) return err("no_database", "Completion requires DATABASE_URL.");
  try {
    const bootstrap = await db.prospectBootstrap.findUnique({ where: { id: bootstrapId } });
    if (!bootstrap || bootstrap.status !== "active") return err("invalid_transition", "Only an active prospect demo can be completed.");
    const updated = await db.$transaction(async (tx) => {
      const row = await tx.prospectBootstrap.update({ where: { id: bootstrap.id }, data: { status: "completed", completed_at: now } });
      if (bootstrap.active_assignment_id) {
        const assignment = await tx.telephonyNumberAssignment.findUnique({ where: { id: bootstrap.active_assignment_id } });
        if (assignment) {
          await tx.telephonyNumberAssignment.update({ where: { id: assignment.id }, data: {
            status: "quarantined",
            unassigned_at: now,
            quarantine_until: addDays(now, PROSPECT_NUMBER_QUARANTINE_DAYS),
            bootstrap_exclusivity_key: null,
          } });
          await tx.telephonyNumber.update({ where: { id: assignment.telephony_number_id }, data: { status: "quarantined" } });
        }
      }
      await tx.agentProfile.updateMany({ where: { account_id: bootstrap.account_id, type: "demo_mode" }, data: { enabled: false } });
      await tx.auditLog.create({ data: auditData({
        accountId: bootstrap.account_id,
        actorUserId: operator.data.user.id,
        actorRole: operator.data.user.role,
        action: "prospect_bootstrap.completed",
        targetType: "ProspectBootstrap",
        targetId: bootstrap.id,
        reason: "Operator marked the supervised prospect demonstration complete.",
      }) });
      return row;
    });
    return ok(updated);
  } catch (error) {
    return errFromThrown(error);
  }
}

export async function resolveActiveProspectAgentContext(target: string, now = new Date()) {
  if (!db) return null;
  let e164: string;
  try { e164 = normalizeE164(target); } catch { return null; }
  const rows = await db.$queryRaw<Array<{
    account_id: string;
    account_name: string;
    bootstrap_id: string;
    assignment_id: string;
    e164: string;
    canonical_website: string;
    memory_json: unknown;
  }>>`
    SELECT
      a.id AS account_id,
      a.name AS account_name,
      pb.id AS bootstrap_id,
      tna.id AS assignment_id,
      tn.e164,
      pb.canonical_website,
      bms.memory_json
    FROM "TelephonyNumber" tn
    JOIN "TelephonyNumberAssignment" tna ON tna.telephony_number_id = tn.id
    JOIN "ProspectBootstrap" pb ON pb.id = tna.bootstrap_id AND pb.account_id = tna.account_id
    JOIN "Account" a ON a.id = pb.account_id
    JOIN "BusinessMemorySnapshot" bms ON bms.id = pb.current_memory_snapshot_id AND bms.account_id = pb.account_id
    WHERE tn.provider = 'telnyx'
      AND tn.e164 = ${e164}
      AND tn.status = 'assigned'::"TelephonyNumberStatus"
      AND tna.status = 'active'::"TelephonyNumberAssignmentStatus"
      AND tna.activated_at <= ${now}
      AND tna.unassigned_at IS NULL
      AND pb.status = 'active'::"ProspectBootstrapStatus"
      AND pb.expires_at > ${now}
      AND bms.status = 'approved'::"BusinessMemorySnapshotStatus"
    ORDER BY tna.assigned_at DESC
    LIMIT 1
  `;
  const resolved = rows[0];
  if (!resolved) return null;
  const memory = BusinessMemorySnapshotSchema.parse(resolved.memory_json);
  return {
    accountId: resolved.account_id,
    bootstrapId: resolved.bootstrap_id,
    assignmentId: resolved.assignment_id,
    demoNumber: resolved.e164,
    context: compileProspectAgentContext({ businessName: resolved.account_name, businessWebsite: resolved.canonical_website, memory }),
  };
}

export async function resolveTelnyxEventAssignment(params: { target: string; occurredAt: Date; receivedAt?: Date }) {
  if (!db) return null;
  const receivedAt = params.receivedAt ?? new Date();
  if (addDays(params.occurredAt, PROSPECT_CONTENT_RETENTION_DAYS) <= receivedAt) return null;
  let e164: string;
  try { e164 = normalizeE164(params.target); } catch { return null; }
  const number = await db.telephonyNumber.findUnique({ where: { provider_e164: { provider: "telnyx", e164 } } });
  if (!number) return null;
  const assignment = await db.telephonyNumberAssignment.findFirst({
    where: {
      telephony_number_id: number.id,
      assigned_at: { lte: params.occurredAt },
      activated_at: { lte: params.occurredAt },
      OR: [{ unassigned_at: null }, { unassigned_at: { gte: params.occurredAt } }],
    },
    orderBy: { assigned_at: "desc" },
  });
  if (!assignment) {
    const quarantined = await db.telephonyNumberAssignment.findFirst({
      where: {
        telephony_number_id: number.id,
        status: "quarantined",
        unassigned_at: { lte: params.occurredAt },
      },
      orderBy: { unassigned_at: "desc" },
    });
    if (quarantined) {
      await db.telephonyNumberAssignment.updateMany({
        where: {
          id: quarantined.id,
          OR: [{ last_inbound_at: null }, { last_inbound_at: { lt: params.occurredAt } }],
        },
        data: { last_inbound_at: params.occurredAt },
      });
    }
    return null;
  }
  const bootstrap = await db.prospectBootstrap.findFirst({
    where: { id: assignment.bootstrap_id, account_id: assignment.account_id },
    select: { status: true, expires_at: true },
  });
  if (
    !bootstrap ||
    bootstrap.status === "cleanup_pending" ||
    bootstrap.status === "cleaned" ||
    (bootstrap.expires_at && params.occurredAt > bootstrap.expires_at)
  ) return null;
  await db.telephonyNumberAssignment.updateMany({
    where: {
      id: assignment.id,
      OR: [{ last_inbound_at: null }, { last_inbound_at: { lt: params.occurredAt } }],
    },
    data: { last_inbound_at: params.occurredAt },
  });
  return { accountId: assignment.account_id, bootstrapId: assignment.bootstrap_id, assignmentId: assignment.id, demoNumber: number.e164 };
}

export async function shouldDispatchCrmForAccount(accountId: string): Promise<boolean> {
  if (!db) return false;
  const account = await db.account.findUnique({ where: { id: accountId }, select: { account_type: true } });
  return account?.account_type === "customer";
}

export async function expireDueProspectBootstraps(now = new Date()) {
  if (!db) return err("no_database", "Expiry requires DATABASE_URL.");
  try {
    const due = await db.prospectBootstrap.findMany({ where: { OR: [
      {
        status: { in: ["draft", "ingesting", "review_required", "approved", "provisioning", "failed"] },
        review_expires_at: { lte: now },
      },
      {
        status: { in: ["ready", "active", "completed", "promotion_pending"] },
        expires_at: { lte: now },
      },
    ] } });
    let expired = 0;
    for (const bootstrap of due) {
      await db.$transaction(async (tx) => {
        let quarantineUntil = addDays(now, PROSPECT_NUMBER_QUARANTINE_DAYS);
        if (bootstrap.active_assignment_id) {
          const assignment = await tx.telephonyNumberAssignment.findUnique({ where: { id: bootstrap.active_assignment_id } });
          if (assignment) {
            if (assignment.status === "assigned" || assignment.status === "active") {
              await tx.telephonyNumberAssignment.update({ where: { id: assignment.id }, data: {
                status: "quarantined",
                unassigned_at: now,
                quarantine_until: quarantineUntil,
                bootstrap_exclusivity_key: null,
              } });
              await tx.telephonyNumber.update({ where: { id: assignment.telephony_number_id }, data: { status: "quarantined" } });
            } else if (assignment.quarantine_until) {
              quarantineUntil = assignment.quarantine_until;
            }
          }
        }
        await tx.agentProfile.updateMany({ where: { account_id: bootstrap.account_id, type: "demo_mode" }, data: { enabled: false } });
        await tx.prospectBootstrap.update({ where: { id: bootstrap.id }, data: {
          status: "expired",
          review_expires_at: null,
          expires_at: now,
        } });
        await tx.auditLog.create({ data: {
          account_id: bootstrap.account_id,
          actor_type: "system",
          action: "prospect_bootstrap.expired",
          category: "workflow",
          target_type: "ProspectBootstrap",
          target_id: bootstrap.id,
          reason: "Prospect bootstrap reached its configured review or demo TTL.",
          metadata_json: {
            previousStatus: bootstrap.status,
            quarantineUntil: quarantineUntil.toISOString(),
          },
          expires_at: addDays(now, PROSPECT_AUDIT_RETENTION_DAYS),
        } });
      });
      expired += 1;
    }
    return ok({ expired });
  } catch (error) {
    return errFromThrown(error);
  }
}

export async function purgeExpiredProspectContent(now = new Date()) {
  if (!db) return err("no_database", "Prospect content purge requires DATABASE_URL.");
  try {
    const [sourceDue, contentDue] = await Promise.all([
      db.knowledgeSource.findMany({ where: { expires_at: { lte: now }, purged_at: null }, select: { bootstrap_id: true }, distinct: ["bootstrap_id"] }),
      db.prospectBootstrap.findMany({
      where: { content_expires_at: { lte: now }, content_purged_at: null },
        select: { id: true },
      }),
    ]);
    const contentDueIds = new Set(contentDue.map(({ id }) => id));
    const dueIds = [...new Set([...sourceDue.map(({ bootstrap_id }) => bootstrap_id), ...contentDueIds])];
    const due = await db.prospectBootstrap.findMany({ where: { id: { in: dueIds } } });
    let accountsPurged = 0;
    let sourcesPurged = 0;
    let factsPurged = 0;
    let webhookPayloadsPurged = 0;
    for (const bootstrap of due) {
      const purgeAccountContent = contentDueIds.has(bootstrap.id);
      const counts = await db.$transaction(async (tx) => {
        const sourceResult = await tx.knowledgeSource.updateMany({
          where: {
            account_id: bootstrap.account_id,
            bootstrap_id: bootstrap.id,
            purged_at: null,
            ...(purgeAccountContent ? {} : { expires_at: { lte: now } }),
          },
          data: { status: "purged", extracted_text: null, purged_at: now },
        });
        const factResult = await tx.knowledgeFact.deleteMany({ where: {
          account_id: bootstrap.account_id,
          bootstrap_id: bootstrap.id,
          ...(purgeAccountContent ? {} : { expires_at: { lte: now } }),
        } });
        let webhookPayloadsPurged = 0;
        if (purgeAccountContent) {
        const calls = await tx.call.findMany({ where: { account_id: bootstrap.account_id }, select: { id: true } });
        const callIds = calls.map(({ id }) => id);
        const leads = await tx.leadEvent.findMany({ where: { account_id: bootstrap.account_id }, select: { id: true } });
        await tx.leadQualification.deleteMany({ where: { lead_event_id: { in: leads.map(({ id }) => id) } } });
        await tx.leadEvent.deleteMany({ where: { account_id: bootstrap.account_id } });
        await tx.callSegment.deleteMany({ where: { account_id: bootstrap.account_id } });
        await tx.callTranscript.updateMany({ where: { account_id: bootstrap.account_id }, data: {
          inline_text: null,
          raw_ref: null,
          redacted_ref: null,
          retention_lane: "metadata_only",
          redacted_at: now,
        } });
        await tx.call.updateMany({ where: { id: { in: callIds } }, data: {
          contact_id: null,
          from_number: "<PURGED>",
          transcript: null,
          summary: null,
        } });
        await tx.contact.deleteMany({ where: { account_id: bootstrap.account_id } });
        await tx.qaLog.deleteMany({ where: { account_id: bootstrap.account_id } });
        await tx.workflowRun.deleteMany({ where: { account_id: bootstrap.account_id } });
        await tx.crmSyncOperation.deleteMany({ where: { account_id: bootstrap.account_id } });
        const webhookResult = await tx.webhookEvent.updateMany({ where: {
          account_id: bootstrap.account_id,
          payload_expires_at: { lte: now },
          payload_purged_at: null,
        }, data: {
          raw_body: "<PURGED_PROSPECT_DEMO_PAYLOAD>",
          signature_header: null,
          process_error: null,
          payload_purged_at: now,
        } });
        webhookPayloadsPurged = webhookResult.count;
        await tx.businessMemorySnapshot.deleteMany({ where: { account_id: bootstrap.account_id, bootstrap_id: bootstrap.id } });
        await tx.bootstrapPromotion.updateMany({ where: { account_id: bootstrap.account_id, bootstrap_id: bootstrap.id }, data: {
          manifest_json: { purged: true, reason: "demo_content_retention_elapsed" },
        } });
        await tx.prospectBootstrap.update({ where: { id: bootstrap.id }, data: {
          current_memory_snapshot_id: null,
          content_purged_at: now,
        } });
        }
        await tx.auditLog.create({ data: {
          account_id: bootstrap.account_id,
          actor_type: "system",
          action: purgeAccountContent ? "prospect_bootstrap.content_purged" : "prospect_bootstrap.source_content_purged",
          category: "workflow",
          target_type: "ProspectBootstrap",
          target_id: bootstrap.id,
          reason: purgeAccountContent
            ? "Prospect source content and caller evidence reached the 30-day retention boundary."
            : "Unactivated prospect source content reached its 30-day retention boundary.",
          metadata_json: { contentPurged: true, callerEvidencePurged: purgeAccountContent, webhookPayloadsPurged, providerResourceChanged: false },
          expires_at: addDays(now, PROSPECT_AUDIT_RETENTION_DAYS),
        } });
        return { sources: sourceResult.count, facts: factResult.count, webhooks: webhookPayloadsPurged };
      });
      sourcesPurged += counts.sources;
      factsPurged += counts.facts;
      webhookPayloadsPurged += counts.webhooks;
      if (purgeAccountContent) accountsPurged += 1;
    }
    return ok({ accountsPurged, sourcesPurged, factsPurged, webhookPayloadsPurged });
  } catch (error) {
    return errFromThrown(error);
  }
}

export async function cleanupExpiredProspectBootstraps(now = new Date()) {
  if (!db) return err("no_database", "Cleanup requires DATABASE_URL.");
  try {
    const cutoff = addDays(now, -PROSPECT_CONTENT_RETENTION_DAYS);
    const due = await db.prospectBootstrap.findMany({ where: { status: "expired", expires_at: { lte: cutoff } } });
    let cleaned = 0;
    for (const bootstrap of due) {
      await db.$transaction(async (tx) => {
        await tx.prospectBootstrap.update({ where: { id: bootstrap.id }, data: { status: "cleanup_pending" } });
        const calls = await tx.call.findMany({ where: { account_id: bootstrap.account_id }, select: { id: true } });
        const callIds = calls.map(({ id }) => id);
        const leads = await tx.leadEvent.findMany({ where: { account_id: bootstrap.account_id }, select: { id: true } });
        await tx.leadQualification.deleteMany({ where: { lead_event_id: { in: leads.map(({ id }) => id) } } });
        await tx.crmSyncOperation.deleteMany({ where: { account_id: bootstrap.account_id } });
        await tx.qaLog.deleteMany({ where: { account_id: bootstrap.account_id } });
        await tx.callTranscript.deleteMany({ where: { account_id: bootstrap.account_id } });
        await tx.callSegment.deleteMany({ where: { account_id: bootstrap.account_id } });
        await tx.leadEvent.deleteMany({ where: { account_id: bootstrap.account_id } });
        await tx.call.deleteMany({ where: { id: { in: callIds } } });
        await tx.contact.deleteMany({ where: { account_id: bootstrap.account_id } });
        await tx.webhookEvent.updateMany({ where: { account_id: bootstrap.account_id }, data: { raw_body: "<PURGED_PROSPECT_DEMO_PAYLOAD>", signature_header: null, process_error: null } });
        await tx.knowledgeFact.deleteMany({ where: { account_id: bootstrap.account_id, bootstrap_id: bootstrap.id } });
        await tx.knowledgeSource.updateMany({ where: { account_id: bootstrap.account_id, bootstrap_id: bootstrap.id }, data: { status: "purged", extracted_text: null, purged_at: now } });
        await tx.businessMemorySnapshot.deleteMany({ where: { account_id: bootstrap.account_id, bootstrap_id: bootstrap.id } });
        await tx.agentProfile.deleteMany({ where: { account_id: bootstrap.account_id, type: "demo_mode" } });
        await tx.account.update({ where: { id: bootstrap.account_id }, data: {
          name: "Expired prospect",
          slug: `expired-${bootstrap.id}`,
          website_url: null,
          primary_phone: null,
          status: "cancelled",
        } });
        await tx.prospectBootstrap.update({ where: { id: bootstrap.id }, data: {
          status: "cleaned",
          active_account_key: null,
          canonical_website: "https://expired.invalid/",
          current_memory_snapshot_id: null,
          cleanup_completed_at: now,
        } });
        await tx.auditLog.create({ data: {
          account_id: bootstrap.account_id,
          actor_type: "system",
          action: "prospect_bootstrap.cleaned",
          category: "workflow",
          target_type: "ProspectBootstrap",
          target_id: bootstrap.id,
          reason: "Temporary prospect content and caller evidence reached retention expiry.",
          metadata_json: { contentPurged: true, credentialMutation: false, providerNumberReleased: false },
          expires_at: addDays(now, PROSPECT_AUDIT_RETENTION_DAYS),
        } });
      });
      cleaned += 1;
    }
    return ok({ cleaned });
  } catch (error) {
    return errFromThrown(error);
  }
}

export async function releaseQuarantinedAssignments(now = new Date()) {
  if (!db) return err("no_database", "Reconciliation requires DATABASE_URL.");
  try {
    const due = await db.telephonyNumberAssignment.findMany({ where: { status: "quarantined", quarantine_until: { lte: now } } });
    let eligible = 0;
    let extended = 0;
    for (const assignment of due) {
      const effectiveUntil = assignment.last_inbound_at ? addDays(assignment.last_inbound_at, PROSPECT_NUMBER_QUARANTINE_DAYS) : assignment.quarantine_until;
      if (effectiveUntil && effectiveUntil > now) {
        await db.$transaction(async (tx) => {
          await tx.telephonyNumberAssignment.update({ where: { id: assignment.id }, data: { quarantine_until: effectiveUntil } });
          await tx.auditLog.create({ data: {
            account_id: assignment.account_id,
            actor_type: "system",
            action: "prospect_bootstrap.number_quarantine_extended",
            category: "workflow",
            target_type: "TelephonyNumberAssignment",
            target_id: assignment.id,
            reason: "An inbound call extended the number reuse quarantine.",
            metadata_json: { quarantineUntil: effectiveUntil.toISOString() },
            expires_at: addDays(now, PROSPECT_AUDIT_RETENTION_DAYS),
          } });
        });
        extended += 1;
        continue;
      }
      eligible += 1;
    }
    return ok({ eligible, extended });
  } catch (error) {
    return errFromThrown(error);
  }
}

export async function approveQuarantinedNumberReuse(assignmentId: string, now = new Date()) {
  const operator = await requireOperator();
  if (!operator.ok) return operator;
  if (!db) return err("no_database", "Number reuse approval requires DATABASE_URL.");
  try {
    const assignment = await db.telephonyNumberAssignment.findUnique({ where: { id: assignmentId } });
    if (!assignment || assignment.status !== "quarantined" || !assignment.quarantine_until) {
      return err("assignment_not_quarantined", "The number assignment is not awaiting reuse approval.");
    }
    const effectiveUntil = assignment.last_inbound_at
      ? addDays(assignment.last_inbound_at, PROSPECT_NUMBER_QUARANTINE_DAYS)
      : assignment.quarantine_until;
    if (effectiveUntil > now) return err("quarantine_active", "The number quarantine has not elapsed.");
    const [unresolvedEvents, unresolvedCalls] = await Promise.all([
      db.webhookEvent.count({ where: { account_id: assignment.account_id, process_status: { in: ["received", "error"] } } }),
      db.call.count({ where: { account_id: assignment.account_id, status: "answered" } }),
    ]);
    if (unresolvedEvents > 0 || unresolvedCalls > 0) {
      return err("number_activity_unresolved", "Resolve outstanding calls and provider events before number reuse.");
    }
    const released = await db.$transaction(async (tx) => {
      const updated = await tx.telephonyNumberAssignment.update({ where: { id: assignment.id }, data: {
        status: "released",
        number_exclusivity_key: null,
      } });
      await tx.telephonyNumber.update({ where: { id: assignment.telephony_number_id }, data: { status: "available" } });
      await tx.auditLog.create({ data: auditData({
        accountId: assignment.account_id,
        actorUserId: operator.data.user.id,
        actorRole: operator.data.user.role,
        action: "prospect_bootstrap.number_reuse_approved",
        targetType: "TelephonyNumberAssignment",
        targetId: assignment.id,
        reason: "Operator approved pool-number reuse after quarantine and unresolved-activity checks.",
        metadata: { telephonyNumberId: assignment.telephony_number_id },
      }) });
      return updated;
    });
    return ok(released);
  } catch (error) {
    return errFromThrown(error);
  }
}

export async function exportBootstrapPromotion(params: { bootstrapId: string; numberRetentionIntent?: "new_production_number" | "request_demo_number_review" }) {
  const operator = await requireOperator();
  if (!operator.ok) return operator;
  if (!db) return err("no_database", "Promotion export requires DATABASE_URL.");
  try {
    const bootstrap = await db.prospectBootstrap.findUnique({ where: { id: params.bootstrapId } });
    if (!bootstrap || bootstrap.status !== "completed" || !bootstrap.current_memory_snapshot_id) return err("bootstrap_not_completed", "Complete the demo before promotion export.");
    const [account, snapshot, profile] = await Promise.all([
      db.account.findUnique({ where: { id: bootstrap.account_id } }),
      db.businessMemorySnapshot.findUnique({ where: { id: bootstrap.current_memory_snapshot_id } }),
      db.agentProfile.findFirst({ where: { account_id: bootstrap.account_id, type: "demo_mode" } }),
    ]);
    if (!account || !snapshot || snapshot.status !== "approved" || !profile) return err("promotion_preflight_failed", "Promotion source is incomplete.");
    const memory = BusinessMemorySnapshotSchema.parse(snapshot.memory_json);
    const built = buildPromotionManifest({
      bootstrapId: bootstrap.id,
      accountId: account.id,
      snapshotId: snapshot.id,
      snapshotHash: snapshot.content_hash,
      memory,
      businessName: account.name,
      canonicalWebsite: bootstrap.canonical_website,
      timezone: account.timezone,
      policy: (profile.system_policy_json ?? {}) as Record<string, unknown>,
      numberRetentionIntent: params.numberRetentionIntent,
    });
    const promotion = await db.$transaction(async (tx) => {
      const row = await tx.bootstrapPromotion.create({ data: {
        account_id: account.id,
        bootstrap_id: bootstrap.id,
        correlation_id: built.manifest.correlationId,
        source_snapshot_id: snapshot.id,
        source_snapshot_hash: snapshot.content_hash,
        manifest_json: built.manifest as never,
        manifest_hash: built.hash,
        status: "exported",
        exported_by: operator.data.user.id,
        exported_at: new Date(built.manifest.exportedAt),
      } });
      await tx.prospectBootstrap.update({ where: { id: bootstrap.id }, data: { status: "promotion_pending", promotion_correlation_id: row.correlation_id } });
      await tx.auditLog.create({ data: auditData({
        accountId: account.id,
        actorUserId: operator.data.user.id,
        actorRole: operator.data.user.role,
        action: "prospect_bootstrap.promotion_exported",
        targetType: "BootstrapPromotion",
        targetId: row.id,
        reason: "Operator exported an allowlisted promotion manifest.",
        metadata: { manifestHash: row.manifest_hash, sourceSnapshotHash: row.source_snapshot_hash },
      }) });
      return row;
    });
    return ok({ promotion, manifest: built.manifest });
  } catch (error) {
    return errFromThrown(error);
  }
}

export async function importBootstrapPromotion(params: { manifest: unknown; manifestHash: string }) {
  const operator = await requireOperator();
  if (!operator.ok) return operator;
  if (process.env.RESPONSEOS_PROMOTION_IMPORT_ENABLED !== "true") {
    return err("promotion_import_disabled", "Production promotion import is disabled.");
  }
  if (!db) return err("no_database", "Promotion import requires DATABASE_URL.");
  try {
    const manifest = validatePromotionManifest(params.manifest, params.manifestHash);
    const existing = await db.businessMemorySnapshot.findUnique({ where: { promotion_correlation_id: manifest.correlationId } });
    if (existing) {
      const account = await db.account.findUnique({ where: { id: existing.account_id } });
      if (!account) return err("promotion_import_inconsistent", "Imported promotion account is missing.");
      return ok({ replay: true as const, account, snapshot: existing });
    }
    const imported = await db.$transaction(async (tx) => {
      const account = await tx.account.create({ data: {
        name: manifest.businessIdentity.name,
        slug: slugify(manifest.businessIdentity.name),
        industry: manifest.businessIdentity.industry,
        website_url: manifest.businessIdentity.canonicalWebsite,
        timezone: manifest.businessIdentity.timezone,
        status: "lead",
        account_type: "customer",
      } });
      const importedMemory = BusinessMemorySnapshotSchema.parse({
        ...manifest.memory,
        accountId: account.id,
        bootstrapId: null,
      });
      const importedMemoryHash = contentHash(importedMemory);
      const snapshot = await tx.businessMemorySnapshot.create({ data: {
        account_id: account.id,
        bootstrap_id: null,
        promotion_correlation_id: manifest.correlationId,
        schema_version: importedMemory.schemaVersion,
        version: 1,
        memory_json: importedMemory as never,
        content_hash: importedMemoryHash,
        template_version: manifest.agent.templateVersion,
        status: "approved",
        approved_by: operator.data.user.id,
        approved_at: new Date(),
      } });
      const profile = await tx.agentProfile.create({ data: {
        account_id: account.id,
        name: `${account.name} Imported Receptionist Draft`,
        slug: "imported-receptionist-draft",
        type: "demo_mode",
        enabled: false,
        is_default: true,
        system_policy_json: manifest.agent.policy as never,
        metadata_json: {
          promotionCorrelationId: manifest.correlationId,
          importedSnapshotId: snapshot.id,
          sourceTemplateVersion: manifest.agent.templateVersion,
          requiresProductionConfiguration: true,
        },
      } });
      await tx.auditLog.create({ data: auditData({
        accountId: account.id,
        actorUserId: operator.data.user.id,
        actorRole: operator.data.user.role,
        action: "prospect_bootstrap.promotion_imported",
        targetType: "Account",
        targetId: account.id,
        reason: "Operator imported an allowlisted prospect package into a new disabled customer tenant.",
        metadata: {
          promotionCorrelationId: manifest.correlationId,
          manifestHash: params.manifestHash,
          sourceSnapshotHash: manifest.sourceSnapshotHash,
          importedSnapshotHash: importedMemoryHash,
        },
      }) });
      return { replay: false as const, account, snapshot, profile };
    });
    return ok(imported);
  } catch (error) {
    const code = error instanceof Error && error.message.startsWith("promotion_")
      ? error.message
      : "promotion_import_invalid";
    return err(code, "The promotion package failed validation or import.");
  }
}

export async function acknowledgeImportedBootstrapPromotion(params: {
  correlationId: string;
  manifestHash: string;
  importedAccountRef: string;
}, now = new Date()) {
  const operator = await requireOperator();
  if (!operator.ok) return operator;
  if (!db) return err("no_database", "Promotion acknowledgment requires DATABASE_URL.");
  const importedAccountRef = params.importedAccountRef.trim();
  if (!importedAccountRef || importedAccountRef.length > 200) {
    return err("invalid_imported_account_ref", "Imported account reference must be 1-200 characters.");
  }
  try {
    const promotion = await db.bootstrapPromotion.findUnique({ where: { correlation_id: params.correlationId } });
    if (!promotion) return err("promotion_not_found", "Promotion export was not found.");
    if (promotion.manifest_hash !== params.manifestHash) {
      return err("promotion_manifest_hash_mismatch", "Manifest hash does not match the exported package.");
    }
    if (promotion.status === "imported") {
      if (promotion.imported_account_ref !== importedAccountRef) {
        return err("promotion_already_acknowledged", "Promotion was acknowledged with a different account reference.");
      }
      const bootstrap = await db.prospectBootstrap.findUnique({ where: { id: promotion.bootstrap_id } });
      if (!bootstrap) return err("promotion_source_missing", "Promotion source bootstrap is missing.");
      return ok({ replay: true as boolean, promotion, bootstrap });
    }
    if (promotion.status !== "exported") return err("promotion_not_exported", "Only an exported promotion may be acknowledged.");
    const acknowledged = await db.$transaction(async (tx) => {
      const bootstrap = await tx.prospectBootstrap.findUnique({ where: { id: promotion.bootstrap_id } });
      if (!bootstrap || bootstrap.status !== "promotion_pending" || bootstrap.promotion_correlation_id !== promotion.correlation_id) {
        throw new Error("promotion_source_not_pending");
      }
      const updatedPromotion = await tx.bootstrapPromotion.update({ where: { id: promotion.id }, data: {
        status: "imported",
        imported_account_ref: importedAccountRef,
        imported_at: now,
      } });
      const updatedBootstrap = await tx.prospectBootstrap.update({ where: { id: bootstrap.id }, data: {
        status: "converted",
        converted_at: now,
        active_account_key: null,
      } });
      await tx.auditLog.create({ data: auditData({
        accountId: bootstrap.account_id,
        actorUserId: operator.data.user.id,
        actorRole: operator.data.user.role,
        action: "prospect_bootstrap.promotion_import_acknowledged",
        targetType: "BootstrapPromotion",
        targetId: promotion.id,
        reason: "Operator acknowledged the exact exported manifest as imported into a disabled customer tenant.",
        metadata: {
          correlationId: promotion.correlation_id,
          manifestHash: promotion.manifest_hash,
          importedAccountRef,
        },
      }) });
      return { promotion: updatedPromotion, bootstrap: updatedBootstrap };
    });
    return ok({ replay: false as boolean, ...acknowledged });
  } catch (error) {
    const code = error instanceof Error ? error.message : "promotion_acknowledgment_failed";
    return err(code, "Promotion import acknowledgment failed.");
  }
}

export function transitionKeepsActiveAccountKey(status: ProspectBootstrapStatus): boolean {
  return !isTerminalProspectBootstrapStatus(status);
}
