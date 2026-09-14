import { BusinessMemorySnapshotSchema } from "@/lib/prospectBootstrap/contracts";
import "@/lib/serverOnlyGuard";
import { db } from "@/lib/db/client";
import { getCurrentSession } from "@/lib/auth/session";
import { isCrossTenantRole } from "@/lib/data/session-helpers";
import { err, errFromThrown, ok, type Result } from "@/lib/data/result";
import { normalizeE164 } from "@/lib/validation/common";
import { contentHash, stableJson } from "@/lib/prospectBootstrap/memory";
import { PROSPECT_AUDIT_RETENTION_DAYS } from "@/lib/prospectBootstrap/contracts";
import { verifyProviderAttestationSignature } from "@/lib/prospectBootstrap/attestation";
import {
  buildOperatingConfigurationSnapshot,
  type OperatingConfigurationInput,
} from "./operatingConfigurationSnapshot";
import { readOperatingConfigurationValue, evaluateOperatingConfiguration } from "./operatingConfiguration";
import { EXECUTION_MODE_POLICIES, type ExecutionMode } from "./policy";
import { authorizedExecutionGates, resolveTenantExecutionPolicy } from "./tenantPolicy";
import { validateSupervisedAssistantPreflight } from "./supervisedTemplate";
import { buildSupervisedAgentContext } from "./supervisedContext";

/**
 * Operator write path for a supervised customer tenant (ADR-0057).
 *
 * One entry point configures the account, its agent profile, its approved
 * operating configuration, its dedicated number, and activation. Everything is
 * idempotent on re-run, and `dryRun` reports exactly what an apply would do
 * without writing.
 *
 * Client operational values (escalation contacts, notification recipients,
 * dedicated numbers) enter the database only here. They are never written to
 * source, fixtures, audit metadata, or any public surface.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
export const SUPERVISED_AGENT_PROFILE_SLUG = "supervised-receptionist";

export type SupervisedExecutionMode = Exclude<ExecutionMode, "PROSPECT_DEMO">;

export interface SupervisedTenantNumberInput {
  providerNumberId: string;
  e164: string;
  providerAttestation: unknown;
}

export interface SupervisedTenantInput {
  accountSlug: string;
  businessName: string;
  timezone: string;
  industry?: string;
  agentName: string;
  executionMode: SupervisedExecutionMode;
  approvalRecordRef: string;
  configuration: readonly OperatingConfigurationInput[];
  number?: SupervisedTenantNumberInput;
  activate?: boolean;
  dryRun?: boolean;
}

export interface SupervisedTenantPlan {
  dryRun: boolean;
  accountId: string | null;
  accountSlug: string;
  profileId: string | null;
  executionMode: SupervisedExecutionMode;
  gateAuthorized: boolean;
  configuration: {
    keys: string[];
    version: number | null;
    hash: string | null;
    unchanged: boolean;
    ready: boolean;
    missing: string[];
  };
  recordingEnabled: boolean;
  number: {
    e164Configured: boolean;
    assignmentId: string | null;
    providerAssistantId: string | null;
  };
  activated: boolean;
  stops: string[];
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
    expires_at: new Date(Date.now() + PROSPECT_AUDIT_RETENTION_DAYS * DAY_MS),
  };
}

export async function configureSupervisedTenant(
  input: SupervisedTenantInput,
  now = new Date(),
): Promise<Result<SupervisedTenantPlan>> {
  const operator = await requireOperator();
  if (!operator.ok) return operator;
  if (!db) return err("no_database", "Supervised tenant configuration requires DATABASE_URL.");

  if (!(input.executionMode in EXECUTION_MODE_POLICIES) || input.executionMode === ("PROSPECT_DEMO" as never)) {
    return err("validation_failed", "A supervised execution mode is required.");
  }
  if (!input.accountSlug.trim() || !input.businessName.trim() || !input.agentName.trim()) {
    return err("validation_failed", "Account slug, business name, and agent name are required.");
  }
  if (!input.approvalRecordRef.trim()) {
    return err("validation_failed", "An operator approval record reference is required.");
  }

  const dryRun = input.dryRun === true;
  const stops: string[] = [];

  try {
    const built = buildOperatingConfigurationSnapshot({
      accountId: input.accountSlug,
      generatedAt: now,
      entries: input.configuration,
      assertion: {
        sourceId: `operator-configuration:${input.accountSlug}`,
        recordRef: input.approvalRecordRef,
        contentHash: contentHash([...input.configuration].sort((a, b) => a.key.localeCompare(b.key))),
        assertedBy: operator.data.user.id,
        assertedAt: now,
      },
      mode: input.executionMode,
    });
    if (built.rejected.length > 0) {
      return err("validation_failed", "Operating configuration values did not validate.", {
        rejected: built.rejected,
      });
    }

    const gates = authorizedExecutionGates();
    const resolved = resolveTenantExecutionPolicy({
      profilePolicy: EXECUTION_MODE_POLICIES[input.executionMode],
      memory: built.memory,
      authorizedGates: gates,
    });
    const gateAuthorized = resolved.mode === input.executionMode;
    const readiness = evaluateOperatingConfiguration(built.memory, input.executionMode);

    const existingAccount = await db.account.findUnique({ where: { slug: input.accountSlug } });
    const enabledProfile = existingAccount && await db.agentProfile.findFirst({
      where: { account_id: existingAccount.id, type: "supervised_receptionist", enabled: true },
    });
    if (enabledProfile && input.activate !== true) stops.push("active_tenant_requires_activation");

    // The account id is only known after the upsert, so the snapshot is rebuilt
    // inside the transaction once it is. Hash comparison uses that final form.
    let numberRow = null as Awaited<ReturnType<NonNullable<typeof db>["telephonyNumber"]["findUnique"]>>;
    let attestationPayload: { assistantId: string } | null = null;

    if (input.number) {
      const e164 = normalizeE164(input.number.e164);
      if (!e164) return err("validation_failed", "The dedicated number is not a valid E.164 number.");

      const legacyDemoNumber = process.env.RESPONSEOS_DEMO_PHONE_E164;
      if (legacyDemoNumber && normalizeE164(legacyDemoNumber) === e164) {
        stops.push("number_is_legacy_demo_number");
      }

      numberRow = await db.telephonyNumber.findUnique({
        where: { provider_e164: { provider: "telnyx", e164 } },
      });
      if (numberRow?.evergreen) stops.push("number_is_evergreen");
      if (numberRow) {
        const conflicting = await db.telephonyNumberAssignment.findFirst({
          where: {
            telephony_number_id: numberRow.id,
            unassigned_at: null,
            status: { in: ["assigned", "active"] },
            NOT: existingAccount ? { account_id: existingAccount.id } : {},
          },
        });
        if (conflicting) stops.push("number_assigned_elsewhere");
      }

      if (stops.length === 0) {
        const attestation = verifyProviderAttestationSignature({
          value: input.number.providerAttestation,
          providerNumberId: input.number.providerNumberId,
          e164,
          publicKey: process.env.RESPONSEOS_PROVIDER_ATTESTATION_PUBLIC_KEY,
          now,
        });
        attestationPayload = validateSupervisedAssistantPreflight(attestation.payload, {
          recordingEnabled: resolved.policy.recordingEnabled,
          allowedTools: resolved.policy.allowedTools,
          transferDestination: readOperatingConfigurationValue(built.memory, "contact.escalation.primary")?.phone ?? null,
        });
      }
    }

    if (input.activate === true) {
      try {
        buildSupervisedAgentContext({ businessName: input.businessName, agentName: input.agentName, memory: built.memory, policy: resolved.policy });
      } catch {
        stops.push("agent_context_invalid");
      }
      if (existingAccount && input.number && await db.telephonyNumberAssignment.findFirst({
        where: { account_id: existingAccount.id, bootstrap_id: null, status: "active", unassigned_at: null, telephony_number_id: { not: numberRow?.id ?? "" } },
      })) stops.push("dedicated_number_change_requires_release");
      if (!readOperatingConfigurationValue(built.memory, "policy.consent")?.transcription.enabled) stops.push("transcription_required_for_review");
      if (!readOperatingConfigurationValue(built.memory, "business.knowledge")) stops.push("approved_business_knowledge_required");
      if (!readOperatingConfigurationValue(built.memory, "notification.completed_interaction.recipient")?.enabled) stops.push("notification_recipient_required");
      if (readOperatingConfigurationValue(built.memory, "policy.consent")?.recording.enabled) stops.push("recording_not_authorized");
      if (input.executionMode !== "SUPERVISED_PILOT") stops.push("only_supervised_demo_in_scope");
      if (!readiness.ready) stops.push("operating_configuration_incomplete");
      if (!gateAuthorized) stops.push("activation_gate_not_authorized");
      if (!input.number) stops.push("dedicated_number_required_for_activation");
    }

    const plan: SupervisedTenantPlan = {
      dryRun,
      accountId: existingAccount?.id ?? null,
      accountSlug: input.accountSlug,
      profileId: null,
      executionMode: input.executionMode,
      gateAuthorized,
      configuration: {
        keys: input.configuration.map((entry) => entry.key).sort(),
        version: null,
        hash: null,
        unchanged: false,
        ready: readiness.ready,
        missing: readiness.missing,
      },
      recordingEnabled: resolved.policy.recordingEnabled,
      number: {
        e164Configured: Boolean(input.number),
        assignmentId: null,
        providerAssistantId: attestationPayload?.assistantId ?? null,
      },
      activated: false,
      stops,
    };

    if (stops.length > 0) {
      return err("configuration_stopped", "Supervised tenant configuration stopped before any write.", {
        stops,
        plan: { ...plan, dryRun: true },
      });
    }
    if (dryRun) return ok(plan);

    const applied = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"supervised-config:" + input.accountSlug}))`;
      const account = await tx.account.upsert({
        where: { slug: input.accountSlug },
        create: {
          name: input.businessName,
          slug: input.accountSlug,
          industry: input.industry ?? "home-services",
          timezone: input.timezone,
          status: "active",
        },
        update: { name: input.businessName, timezone: input.timezone },
      });

      if (input.activate !== true && await tx.agentProfile.findFirst({
        where: { account_id: account.id, type: "supervised_receptionist", enabled: true },
      })) throw new Error("active_tenant_requires_activation");
      if (input.activate === true && input.number && await tx.telephonyNumberAssignment.findFirst({
        where: { account_id: account.id, bootstrap_id: null, status: "active", unassigned_at: null, telephony_number_id: { not: numberRow?.id ?? "" } },
      })) throw new Error("dedicated_number_change_requires_release");

      const snapshotBuild = buildOperatingConfigurationSnapshot({
        accountId: account.id,
        generatedAt: now,
        entries: input.configuration,
        assertion: {
          sourceId: `operator-configuration:${account.id}`,
          recordRef: input.approvalRecordRef,
          contentHash: contentHash([...input.configuration].sort((a, b) => a.key.localeCompare(b.key))),
          assertedBy: operator.data.user.id,
          assertedAt: now,
        },
        mode: input.executionMode,
      });

      const profile = await tx.agentProfile.upsert({
        where: { account_id_slug: { account_id: account.id, slug: SUPERVISED_AGENT_PROFILE_SLUG } },
        create: {
          account_id: account.id,
          name: input.agentName,
          slug: SUPERVISED_AGENT_PROFILE_SLUG,
          type: "supervised_receptionist",
          enabled: false,
          is_default: true,
          system_policy_json: EXECUTION_MODE_POLICIES[input.executionMode] as never,
          metadata_json: { agentName: input.agentName } as never,
        },
        update: {
          name: input.agentName,
          system_policy_json: EXECUTION_MODE_POLICIES[input.executionMode] as never,
          metadata_json: { agentName: input.agentName } as never,
        },
      });

      const latest = await tx.businessMemorySnapshot.findFirst({
        where: { account_id: account.id, bootstrap_id: null },
        orderBy: { version: "desc" },
      });
      const current = await tx.businessMemorySnapshot.findFirst({
        where: { account_id: account.id, bootstrap_id: null, status: "approved" },
        orderBy: { version: "desc" },
      });

      let snapshot = current;
      const previous = current ? BusinessMemorySnapshotSchema.safeParse(current.memory_json) : null;
      const configurationFingerprint = (memory: typeof snapshotBuild.memory) => contentHash([
        ...memory.businessProfile, ...memory.services, ...memory.locations, ...memory.operatingHours,
        ...memory.serviceAreas, ...memory.faqs, ...memory.policies, ...memory.contactPaths, ...memory.brandVoice,
      ].map((fact) => ({ key: fact.key, value: fact.value, status: fact.status,
        sourceEvidence: fact.sourceEvidence.map((source) => {
          if ("kind" in source && source.kind === "operator_assertion") {
            return { sourceId: source.sourceId, recordRef: source.recordRef, contentHash: source.contentHash, assertedBy: source.assertedBy };
          }
          return source;
        }),
      })).sort((a, b) => a.key.localeCompare(b.key)));
      const unchanged = previous?.success === true && configurationFingerprint(previous.data) === configurationFingerprint(snapshotBuild.memory);
      if (!unchanged) {
        if (current) {
          await tx.businessMemorySnapshot.update({
            where: { id: current.id },
            data: { status: "revoked", revoked_at: now },
          });
        }
        snapshot = await tx.businessMemorySnapshot.create({
          data: {
            account_id: account.id,
            bootstrap_id: null,
            schema_version: snapshotBuild.memory.schemaVersion,
            version: (latest?.version ?? 0) + 1,
            memory_json: snapshotBuild.memory as never,
            content_hash: snapshotBuild.hash,
            template_version: input.executionMode,
            status: "approved",
            approved_by: operator.data.user.id,
            approved_at: now,
          },
        });
        await tx.auditLog.create({
          data: auditData({
            accountId: account.id,
            actorUserId: operator.data.user.id,
            actorRole: operator.data.user.role,
            action: "supervised_tenant.configuration_approved",
            targetType: "BusinessMemorySnapshot",
            targetId: snapshot.id,
            reason: "Operator approved a supervised tenant operating configuration.",
            // Keys and hashes only. Client contact values never enter the audit stream.
            metadata: {
              configuredKeys: plan.configuration.keys,
              snapshotHash: snapshotBuild.hash,
              version: snapshot.version,
              ready: readiness.ready,
              missing: readiness.missing,
            },
          }),
        });
      }

      let assignmentId: string | null = null;
      if (input.number && attestationPayload) {
        const e164 = normalizeE164(input.number.e164)!;
        const capabilities = { voice: true, providerAttestation: input.number.providerAttestation };
        const number = await tx.telephonyNumber.upsert({
          where: { provider_e164: { provider: "telnyx", e164 } },
          create: {
            provider: "telnyx",
            provider_number_id: input.number.providerNumberId,
            e164,
            status: "assigned",
            evergreen: false,
            acquired_at: now,
            capabilities_json: capabilities as never,
          },
          update: {
            provider_number_id: input.number.providerNumberId,
            status: "assigned",
            capabilities_json: capabilities as never,
          },
        });

        const existingAssignment = await tx.telephonyNumberAssignment.findFirst({
          where: {
            telephony_number_id: number.id,
            account_id: account.id,
            bootstrap_id: null,
            unassigned_at: null,
          },
          orderBy: { assigned_at: "desc" },
        });
        const assignment = existingAssignment
          ? await tx.telephonyNumberAssignment.update({
              where: { id: existingAssignment.id },
              data: { provider_assistant_id: attestationPayload.assistantId },
            })
          : await tx.telephonyNumberAssignment.create({
              data: {
                account_id: account.id,
                bootstrap_id: null,
                telephony_number_id: number.id,
                provider_assistant_id: attestationPayload.assistantId,
                status: "assigned",
                assigned_at: now,
                number_exclusivity_key: number.id,
              },
            });
        assignmentId = assignment.id;

        await tx.auditLog.create({
          data: auditData({
            accountId: account.id,
            actorUserId: operator.data.user.id,
            actorRole: operator.data.user.role,
            action: "supervised_tenant.number_assigned",
            targetType: "TelephonyNumberAssignment",
            targetId: assignment.id,
            reason: "Operator bound a dedicated provider number to a supervised tenant.",
            metadata: {
              telephonyNumberId: number.id,
              providerAssistantId: attestationPayload.assistantId,
              recordingEnabled: resolved.policy.recordingEnabled,
            },
          }),
        });
      }

      let activated = false;
      if (input.activate === true && assignmentId && snapshot) {
        if (stableJson(profile.system_policy_json) !== stableJson(EXECUTION_MODE_POLICIES[input.executionMode])) {
          throw new Error("policy_checksum_mismatch");
        }
        // A number that stayed active through a reconfiguration keeps its
        // original activation time: a delayed or redelivered webhook from
        // before this moment must still satisfy `activated_at <= occurredAt`.
        const current = await tx.telephonyNumberAssignment.findUnique({ where: { id: assignmentId }, select: { status: true, activated_at: true } });
        const activatedAt = current?.status === "active" && current.activated_at ? current.activated_at : now;
        await tx.telephonyNumberAssignment.update({
          where: { id: assignmentId },
          data: { status: "active", activated_at: activatedAt },
        });
        await tx.agentProfile.update({ where: { id: profile.id }, data: { enabled: true } });
        await tx.account.update({ where: { id: account.id }, data: { status: "active" } });
        activated = true;
        await tx.auditLog.create({
          data: auditData({
            accountId: account.id,
            actorUserId: operator.data.user.id,
            actorRole: operator.data.user.role,
            action: "supervised_tenant.activated",
            targetType: "TelephonyNumberAssignment",
            targetId: assignmentId,
            reason: "Operator activated a supervised inbound tenant.",
            metadata: {
              executionMode: input.executionMode,
              recordingEnabled: resolved.policy.recordingEnabled,
              crmSyncEnabled: resolved.policy.crmSyncEnabled,
              snapshotVersion: snapshot.version,
            },
          }),
        });
      }

      return {
        ...plan,
        accountId: account.id,
        profileId: profile.id,
        configuration: {
          ...plan.configuration,
          version: snapshot?.version ?? null,
          hash: snapshot?.content_hash ?? snapshotBuild.hash,
          unchanged,
        },
        number: { ...plan.number, assignmentId },
        activated,
      } satisfies SupervisedTenantPlan;
    });

    return ok(applied);
  } catch (error) {
    const code = error instanceof Error ? error.message : "configuration_failed";
    if (/^(assistant_|number_recording_|consent_transport_)[a-z_]+$/.test(code)) return err(code, "The provider preflight does not satisfy this demonstration's controls.");
    return errFromThrown(error);
  }
}
