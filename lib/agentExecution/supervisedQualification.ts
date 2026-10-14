import "@/lib/serverOnlyGuard";
import { db } from "@/lib/db/client";
import { getCurrentSession } from "@/lib/auth/session";
import { isCrossTenantRole } from "@/lib/data/session-helpers";
import { err, errFromThrown, ok, type Result } from "@/lib/data/result";
import { BusinessMemorySnapshotSchema, PROSPECT_AUDIT_RETENTION_DAYS } from "@/lib/prospectBootstrap/contracts";
import { normalizeE164 } from "@/lib/validation/common";
import { buildSupervisedAgentContext } from "./supervisedContext";
import {
  evaluateOperatingConfiguration,
  readOperatingConfigurationValue,
} from "./operatingConfiguration";
import { SUPERVISED_QUALIFICATION_POLICY } from "./policy";
import { executionModeFromProfilePolicy } from "./tenantPolicy";
import { SUPERVISED_AGENT_PROFILE_SLUG } from "./supervisedTenant";

const DAY_MS = 24 * 60 * 60 * 1000;

function qualificationError(code: string) {
  return Object.assign(new Error(code), { code });
}

export interface StartSupervisedQualificationInput {
  accountSlug: string;
  providerNumberId: string;
  e164: string;
  providerAssistantId: string;
  approvalRecordRef: string;
}

export interface EndSupervisedQualificationInput {
  accountSlug: string;
  e164: string;
  reason: string;
}

export interface SupervisedQualificationResult {
  accountId: string;
  assignmentId: string;
  status: "qualification";
  providerAssistantId: string;
  created: boolean;
  ended: boolean;
}

async function requireOperator() {
  const session = await getCurrentSession();
  if (!session) return err("no_session", "No active session.");
  if (!isCrossTenantRole(session)) return err("role_denied", "Operator access is required.");
  return ok(session);
}

function auditData(params: {
  accountId: string;
  actorUserId: string;
  actorRole: "aj_admin" | "operator" | "client_admin" | "client_viewer";
  action: string;
  assignmentId: string;
  reason: string;
  metadata: Record<string, unknown>;
}) {
  return {
    account_id: params.accountId,
    actor_user_id: params.actorUserId,
    actor_type: "user" as const,
    actor_role: params.actorRole,
    action: params.action,
    category: "workflow" as const,
    target_type: "TelephonyNumberAssignment",
    target_id: params.assignmentId,
    reason: params.reason,
    metadata_json: params.metadata as never,
    expires_at: new Date(Date.now() + PROSPECT_AUDIT_RETENTION_DAYS * DAY_MS),
  };
}

function qualificationReadiness(memory: ReturnType<typeof BusinessMemorySnapshotSchema.parse>) {
  const readiness = evaluateOperatingConfiguration(memory, "SUPERVISED_PILOT");
  if (!readOperatingConfigurationValue(memory, "business.knowledge")) readiness.missing.push("business.knowledge");
  if (!readOperatingConfigurationValue(memory, "notification.completed_interaction.recipient")?.enabled) {
    readiness.missing.push("notification.completed_interaction.recipient");
  }
  const consent = readOperatingConfigurationValue(memory, "policy.consent");
  if (consent?.transcription.enabled !== true) readiness.missing.push("policy.consent.transcription");
  if (consent?.recording.enabled !== false) readiness.missing.push("policy.consent.recording_off");
  readiness.ready = readiness.ready && readiness.missing.length === 0;
  return readiness;
}

export async function startSupervisedQualification(
  input: StartSupervisedQualificationInput,
  now = new Date(),
): Promise<Result<SupervisedQualificationResult>> {
  const operator = await requireOperator();
  if (!operator.ok) return operator;
  if (!db) return err("no_database", "Supervised qualification requires DATABASE_URL.");

  const e164 = normalizeE164(input.e164);
  if (!e164 || !input.accountSlug.trim() || !input.providerNumberId.trim() || !input.providerAssistantId.trim() || !input.approvalRecordRef.trim()) {
    return err("validation_failed", "Account, number, assistant, and approval reference are required.");
  }
  if (normalizeE164(process.env.RESPONSEOS_DEMO_PHONE_E164 ?? "") === e164) {
    return err("legacy_demo_number_forbidden", "The legacy demonstration number cannot be used for supervised qualification.");
  }

  try {
    const account = await db.account.findUnique({ where: { slug: input.accountSlug } });
    if (!account) return err("account_not_found", "Configure the supervised tenant before qualification.");
    const [profile, snapshot] = await Promise.all([
      db.agentProfile.findUnique({
        where: { account_id_slug: { account_id: account.id, slug: SUPERVISED_AGENT_PROFILE_SLUG } },
      }),
      db.businessMemorySnapshot.findFirst({
        where: { account_id: account.id, bootstrap_id: null, status: "approved" },
        orderBy: { version: "desc" },
      }),
    ]);
    if (!profile || profile.enabled || executionModeFromProfilePolicy(profile.system_policy_json) !== "SUPERVISED_PILOT") {
      return err("qualification_profile_invalid", "Qualification requires a disabled supervised-pilot profile.");
    }
    if (!snapshot) return err("qualification_snapshot_missing", "Qualification requires an approved operating snapshot.");
    const parsed = BusinessMemorySnapshotSchema.safeParse(snapshot.memory_json);
    if (!parsed.success) return err("qualification_snapshot_invalid", "The approved operating snapshot is invalid.");
    const readiness = qualificationReadiness(parsed.data);
    if (!readiness.ready) {
      return err("qualification_configuration_incomplete", "The approved operating configuration is incomplete.", {
        missing: readiness.missing,
        conflicts: readiness.conflicts,
      });
    }
    buildSupervisedAgentContext({
      businessName: account.name,
      agentName: profile.name,
      memory: parsed.data,
      policy: SUPERVISED_QUALIFICATION_POLICY,
    });

    const result = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"supervised-qualification:" + e164}))`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"supervised-config:" + input.accountSlug}))`;
      const [currentAccount, currentProfile, currentSnapshot] = await Promise.all([
        tx.account.findUnique({ where: { id: account.id } }),
        tx.agentProfile.findUnique({ where: { id: profile.id } }),
        tx.businessMemorySnapshot.findFirst({
          where: { account_id: account.id, bootstrap_id: null, status: "approved" },
          orderBy: { version: "desc" },
        }),
      ]);
      if (!currentProfile || currentProfile.enabled || executionModeFromProfilePolicy(currentProfile.system_policy_json) !== "SUPERVISED_PILOT") {
        throw qualificationError("qualification_profile_invalid");
      }
      if (!currentAccount || !currentSnapshot) throw qualificationError("qualification_snapshot_missing");
      const currentMemory = BusinessMemorySnapshotSchema.safeParse(currentSnapshot.memory_json);
      if (!currentMemory.success) throw qualificationError("qualification_snapshot_invalid");
      if (!qualificationReadiness(currentMemory.data).ready) throw qualificationError("qualification_configuration_incomplete");
      buildSupervisedAgentContext({
        businessName: currentAccount.name,
        agentName: currentProfile.name,
        memory: currentMemory.data,
        policy: SUPERVISED_QUALIFICATION_POLICY,
      });

      let number = await tx.telephonyNumber.findUnique({ where: { provider_e164: { provider: "telnyx", e164 } } });
      if (number && (number.provider_number_id !== input.providerNumberId || number.evergreen)) {
        throw qualificationError(number.evergreen ? "evergreen_number_forbidden" : "provider_number_mismatch");
      }
      if (number) {
        const current = await tx.telephonyNumberAssignment.findFirst({
          where: { telephony_number_id: number.id, unassigned_at: null },
          orderBy: { assigned_at: "desc" },
        });
        if (current) {
          if (
            current.status === "qualification" &&
            current.account_id === account.id &&
            current.provider_assistant_id === input.providerAssistantId
          ) {
            return { assignment: current, created: false };
          }
          throw qualificationError("number_assignment_conflict");
        }
        if (number.status !== "available") throw qualificationError("number_not_available");
      }

      const otherQualification = await tx.telephonyNumberAssignment.findFirst({
        where: { account_id: account.id, bootstrap_id: null, status: "qualification", unassigned_at: null },
      });
      if (otherQualification) throw qualificationError("qualification_assignment_conflict");

      number = number
        ? await tx.telephonyNumber.update({ where: { id: number.id }, data: { status: "assigned" } })
        : await tx.telephonyNumber.create({
            data: {
              provider: "telnyx",
              provider_number_id: input.providerNumberId,
              e164,
              status: "assigned",
              evergreen: false,
              acquired_at: now,
              capabilities_json: { voice: true },
            },
          });
      const assignment = await tx.telephonyNumberAssignment.create({
        data: {
          account_id: account.id,
          bootstrap_id: null,
          telephony_number_id: number.id,
          provider_assistant_id: input.providerAssistantId,
          status: "qualification",
          number_exclusivity_key: number.id,
          assigned_at: now,
        },
      });
      await tx.auditLog.create({
        data: auditData({
          accountId: account.id,
          actorUserId: operator.data.user.id,
          actorRole: operator.data.user.role,
          action: "supervised_qualification.started",
          assignmentId: assignment.id,
          reason: "Operator opened an effects-disabled provider qualification assignment.",
          metadata: {
            approvalRecordRef: input.approvalRecordRef,
            telephonyNumberId: number.id,
            providerAssistantId: input.providerAssistantId,
            recordingEnabled: false,
            businessEffectsEnabled: false,
          },
        }),
      });
      return { assignment, created: true };
    });

    return ok({
      accountId: account.id,
      assignmentId: result.assignment.id,
      status: "qualification",
      providerAssistantId: result.assignment.provider_assistant_id,
      created: result.created,
      ended: false,
    });
  } catch (error) {
    return errFromThrown(error);
  }
}

export async function endSupervisedQualification(
  input: EndSupervisedQualificationInput,
  now = new Date(),
): Promise<Result<SupervisedQualificationResult>> {
  const operator = await requireOperator();
  if (!operator.ok) return operator;
  if (!db) return err("no_database", "Supervised qualification requires DATABASE_URL.");
  const e164 = normalizeE164(input.e164);
  if (!e164 || !input.accountSlug.trim() || !input.reason.trim()) {
    return err("validation_failed", "Account, number, and an operator reason are required.");
  }

  try {
    const result = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"supervised-qualification:" + e164}))`;
      const account = await tx.account.findUnique({ where: { slug: input.accountSlug } });
      const number = await tx.telephonyNumber.findUnique({ where: { provider_e164: { provider: "telnyx", e164 } } });
      if (!account || !number) throw qualificationError("qualification_assignment_not_found");
      const assignment = await tx.telephonyNumberAssignment.findFirst({
        where: {
          account_id: account.id,
          telephony_number_id: number.id,
          bootstrap_id: null,
          status: "qualification",
          unassigned_at: null,
        },
      });
      if (!assignment) throw qualificationError("qualification_assignment_not_found");
      const ended = await tx.telephonyNumberAssignment.update({
        where: { id: assignment.id },
        data: { unassigned_at: now, number_exclusivity_key: null },
      });
      await tx.telephonyNumber.update({ where: { id: number.id }, data: { status: "available" } });
      await tx.auditLog.create({
        data: auditData({
          accountId: account.id,
          actorUserId: operator.data.user.id,
          actorRole: operator.data.user.role,
          action: "supervised_qualification.ended",
          assignmentId: assignment.id,
          reason: input.reason,
          metadata: {
            telephonyNumberId: number.id,
            providerAssistantId: assignment.provider_assistant_id,
            historicalEvidencePreserved: true,
          },
        }),
      });
      return { account, assignment: ended };
    });
    return ok({
      accountId: result.account.id,
      assignmentId: result.assignment.id,
      status: "qualification",
      providerAssistantId: result.assignment.provider_assistant_id,
      created: false,
      ended: true,
    });
  } catch (error) {
    return errFromThrown(error);
  }
}
