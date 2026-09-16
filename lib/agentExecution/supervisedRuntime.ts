import "@/lib/serverOnlyGuard";
import type { TelephonyNumberAssignmentStatus } from "@prisma/client";
import { db } from "@/lib/db/client";
import { findCallCorrelation } from "@/lib/data/webhookEvents";
import { BusinessMemorySnapshotSchema, type BusinessMemorySnapshot } from "@/lib/prospectBootstrap/contracts";
import { normalizeE164 } from "@/lib/validation/common";
import {
  evaluateOperatingConfiguration,
  readOperatingConfigurationValue,
  type OperatingConfigurationReadiness,
} from "./operatingConfiguration";
import {
  authorizedExecutionGates,
  executionModeFromProfilePolicy,
  resolveTenantExecutionPolicy,
  type ResolvedTenantPolicy,
} from "./tenantPolicy";
import {
  SUPERVISED_QUALIFICATION_POLICY,
  type ExecutionPolicy,
} from "./policy";

/**
 * Resolves which supervised tenant owns an inbound number, and what its agent
 * is permitted to do on that call (ADR-0057).
 *
 * A supervised assignment is a `TelephonyNumberAssignment` with no bootstrap:
 * prospect-demo assignments always carry one, so the two lanes cannot resolve
 * to each other even though they share the assignment table.
 */

export interface SupervisedTenantRuntime {
  accountId: string;
  accountName: string;
  assignmentId: string;
  numberE164: string;
  agentName: string;
  profileId: string;
  snapshotId: string;
  memory: BusinessMemorySnapshot;
  resolved: ResolvedTenantPolicy;
  assignmentStatus: TelephonyNumberAssignmentStatus;
  contextPolicy: ExecutionPolicy;
  providerEvidenceAuthorized: boolean;
  readiness: OperatingConfigurationReadiness;
}

function agentNameFrom(profile: { name: string; metadata_json: unknown }): string {
  const metadata = profile.metadata_json;
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    const agentName = (metadata as Record<string, unknown>).agentName;
    if (typeof agentName === "string" && agentName.trim()) return agentName.trim();
  }
  return profile.name;
}

export async function resolveSupervisedTenantForNumber(
  target: string,
  now = new Date(),
): Promise<SupervisedTenantRuntime | null> {
  if (!db) return null;
  const e164 = normalizeE164(target);
  if (!e164) return null;

  const number = await db.telephonyNumber.findUnique({
    where: { provider_e164: { provider: "telnyx", e164 } },
  });
  if (!number) return null;

  // Ownership is the assignment whose interval contains the event time, the
  // same rule the prospect resolver uses. A delayed event for a number that
  // has since been released or reassigned still belongs to the tenant that
  // held it when the call happened; it must never resolve to the current one.
  const assignment = await db.telephonyNumberAssignment.findFirst({
    where: {
      telephony_number_id: number.id,
      bootstrap_id: null,
      AND: [
        { OR: [
          { status: "qualification", assigned_at: { lte: now } },
          { status: { in: ["active", "quarantined", "released"] }, activated_at: { lte: now } },
        ] },
        { OR: [{ unassigned_at: null }, { unassigned_at: { gte: now } }] },
      ],
    },
    orderBy: { assigned_at: "desc" },
  });
  if (!assignment) return null;

  const [account, profile, snapshot] = await Promise.all([
    db.account.findUnique({ where: { id: assignment.account_id } }),
    assignment.status === "qualification"
      ? db.agentProfile.findUnique({
          where: {
            account_id_slug: {
              account_id: assignment.account_id,
              slug: "supervised-receptionist",
            },
          },
        })
      : db.agentProfile.findFirst({
          where: {
            account_id: assignment.account_id,
            type: "supervised_receptionist",
            enabled: true,
          },
          orderBy: { created_at: "asc" },
        }),
    db.businessMemorySnapshot.findFirst({
      where: { account_id: assignment.account_id, bootstrap_id: null, status: "approved" },
      orderBy: { version: "desc" },
    }),
  ]);
  if (!account || !profile || !snapshot) return null;

  const parsed = BusinessMemorySnapshotSchema.safeParse(snapshot.memory_json);
  if (!parsed.success) return null;
  const memory = parsed.data;

  const resolved = resolveTenantExecutionPolicy({
    profilePolicy: profile.system_policy_json,
    memory,
    authorizedGates: authorizedExecutionGates(),
  });
  const qualification = assignment.status === "qualification";
  const qualificationAuthorized = qualification &&
    (assignment.unassigned_at !== null || profile.enabled === false) &&
    executionModeFromProfilePolicy(profile.system_policy_json) === "SUPERVISED_PILOT";
  const contextPolicy = qualificationAuthorized ? SUPERVISED_QUALIFICATION_POLICY : resolved.policy;

  return {
    accountId: account.id,
    accountName: account.name,
    assignmentId: assignment.id,
    numberE164: number.e164,
    agentName: agentNameFrom(profile),
    profileId: profile.id,
    snapshotId: snapshot.id,
    memory,
    resolved,
    assignmentStatus: assignment.status,
    contextPolicy,
    providerEvidenceAuthorized: qualification
      ? qualificationAuthorized
      : resolved.degraded === null && resolved.mode === "SUPERVISED_PILOT",
    readiness: (() => {
      const result = evaluateOperatingConfiguration(memory, qualification ? "SUPERVISED_PILOT" : resolved.mode);
      if (!readOperatingConfigurationValue(memory, "business.knowledge")) result.missing.push("business.knowledge");
      if (!readOperatingConfigurationValue(memory, "notification.completed_interaction.recipient")?.enabled) result.missing.push("notification.completed_interaction.recipient");
      if (qualification) {
        const consent = readOperatingConfigurationValue(memory, "policy.consent");
        if (consent?.transcription.enabled !== true) result.missing.push("policy.consent.transcription");
        if (consent?.recording.enabled !== false) result.missing.push("policy.consent.recording_off");
      }
      result.ready = result.ready && result.missing.length === 0;
      return result;
    })(),
  };
}

/**
 * Whether a number is owned by a supervised tenant at all, independent of
 * whether that tenant's runtime currently resolves. A real client's number
 * must answer with the neutral supervised wording when the tenant fails
 * closed, never with prospect-demonstration copy.
 */
export async function findSupervisedNumberOwner(
  target: string,
  now = new Date(),
): Promise<{ accountId: string; assignmentId: string } | null> {
  if (!db) return null;
  const e164 = normalizeE164(target);
  if (!e164) return null;
  const number = await db.telephonyNumber.findUnique({ where: { provider_e164: { provider: "telnyx", e164 } } });
  if (!number) return null;
  const assignment = await db.telephonyNumberAssignment.findFirst({
    where: {
      telephony_number_id: number.id,
      bootstrap_id: null,
      AND: [
        { OR: [
          { status: "qualification", assigned_at: { lte: now } },
          { status: { in: ["active", "quarantined", "released"] }, activated_at: { lte: now } },
        ] },
        { OR: [{ unassigned_at: null }, { unassigned_at: { gte: now } }] },
      ],
    },
    orderBy: { assigned_at: "desc" },
    select: { id: true, account_id: true },
  });
  return assignment ? { accountId: assignment.account_id, assignmentId: assignment.id } : null;
}

/**
 * Re-checks that supervised execution is still authorized for an account.
 *
 * The execution gate is an operational kill switch: assistant initialization
 * fails closed when it is revoked, so an external effect approved before the
 * revocation must not be allowed to bypass it afterwards.
 */
export async function supervisedExecutionAuthorized(accountId: string, callId?: string): Promise<boolean> {
  if (!db) return false;
  if (callId && await supervisedCallWasQualification(accountId, callId)) return false;
  const profile = await db.agentProfile.findFirst({
    where: { account_id: accountId, type: "supervised_receptionist", enabled: true },
    orderBy: { created_at: "asc" },
  });
  if (!profile) return false;
  const resolved = resolveTenantExecutionPolicy({
    profilePolicy: profile.system_policy_json,
    authorizedGates: authorizedExecutionGates(),
  });
  return resolved.degraded === null && resolved.mode === "SUPERVISED_PILOT";
}

/** Qualification evidence can never become a business-effect input later. */
export async function supervisedCallWasQualification(accountId: string, callId: string): Promise<boolean> {
  if (!db) return false;
  const call = await db.call.findFirst({
    where: { id: callId, account_id: accountId },
    select: { to_number: true, started_at: true, provider_call_id: true },
  });
  if (!call) return false;
  const e164 = normalizeE164(call.to_number);
  if (!e164) return false;
  const number = await db.telephonyNumber.findUnique({
    where: { provider_e164: { provider: "telnyx", e164 } },
    select: { id: true },
  });
  if (!number) return false;
  if (call.provider_call_id) {
    const capture = await db.callCaptureSession.findUnique({
      where: {
        account_id_provider_call_id: {
          account_id: accountId,
          provider_call_id: call.provider_call_id,
        },
      },
      select: { assignment_id: true },
    });
    if (capture?.assignment_id) {
      return Boolean(await db.telephonyNumberAssignment.findFirst({
        where: {
          id: capture.assignment_id,
          account_id: accountId,
          telephony_number_id: number.id,
          bootstrap_id: null,
          status: "qualification",
        },
        select: { id: true },
      }));
    }
  }
  const correlation = call.provider_call_id
    ? await findCallCorrelation({ provider: "telnyx", providerCallIds: [call.provider_call_id] })
    : null;
  const correlationTarget = correlation ? normalizeE164(correlation.target) : null;
  const assignmentTime = correlation && correlationTarget === e164
    ? correlation.anchoredAt
    : call.started_at;
  return Boolean(await db.telephonyNumberAssignment.findFirst({
    where: {
      account_id: accountId,
      telephony_number_id: number.id,
      bootstrap_id: null,
      status: "qualification",
      assigned_at: { lte: assignmentTime },
      OR: [{ unassigned_at: null }, { unassigned_at: { gte: assignmentTime } }],
    },
    select: { id: true },
  }));
}

/**
 * Records that a supervised number carried inbound traffic. Never moves the
 * assignment's lifecycle; the prospect lane's quarantine logic is untouched.
 */
export async function touchSupervisedAssignment(assignmentId: string, occurredAt: Date): Promise<void> {
  if (!db) return;
  await db.telephonyNumberAssignment.updateMany({
    where: {
      id: assignmentId,
      OR: [{ last_inbound_at: null }, { last_inbound_at: { lt: occurredAt } }],
    },
    data: { last_inbound_at: occurredAt },
  });
}
