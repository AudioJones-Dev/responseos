import "@/lib/serverOnlyGuard";
import { db } from "@/lib/db/client";
import { BusinessMemorySnapshotSchema, type BusinessMemorySnapshot } from "@/lib/prospectBootstrap/contracts";
import { normalizeE164 } from "@/lib/validation/common";
import {
  evaluateOperatingConfiguration,
  readOperatingConfigurationValue,
  type OperatingConfigurationReadiness,
} from "./operatingConfiguration";
import {
  authorizedExecutionGates,
  resolveTenantExecutionPolicy,
  type ResolvedTenantPolicy,
} from "./tenantPolicy";

/**
 * Resolves which supervised tenant owns an inbound number, and what its agent
 * is permitted to do on that call (ADR-0056).
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
  if (!number || number.status !== "assigned") return null;

  const assignment = await db.telephonyNumberAssignment.findFirst({
    where: {
      telephony_number_id: number.id,
      bootstrap_id: null,
      status: "active",
      unassigned_at: null,
      activated_at: { lte: now },
    },
    orderBy: { assigned_at: "desc" },
  });
  if (!assignment) return null;

  const [account, profile, snapshot] = await Promise.all([
    db.account.findUnique({ where: { id: assignment.account_id } }),
    db.agentProfile.findFirst({
      where: { account_id: assignment.account_id, type: "supervised_receptionist", enabled: true },
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
    readiness: (() => {
      const result = evaluateOperatingConfiguration(memory, resolved.mode);
      if (!readOperatingConfigurationValue(memory, "business.knowledge")) result.missing.push("business.knowledge");
      if (!readOperatingConfigurationValue(memory, "notification.completed_interaction.recipient")?.enabled) result.missing.push("notification.completed_interaction.recipient");
      result.ready = result.ready && result.missing.length === 0;
      return result;
    })(),
  };
}

/**
 * Re-checks that supervised execution is still authorized for an account.
 *
 * The execution gate is an operational kill switch: assistant initialization
 * fails closed when it is revoked, so an external effect approved before the
 * revocation must not be allowed to bypass it afterwards.
 */
export async function supervisedExecutionAuthorized(accountId: string): Promise<boolean> {
  if (!db) return false;
  const profile = await db.agentProfile.findFirst({
    where: { account_id: accountId, type: "supervised_receptionist", enabled: true },
    orderBy: { created_at: "asc" },
  });
  if (!profile) return false;
  const resolved = resolveTenantExecutionPolicy({
    profilePolicy: profile.system_policy_json,
    authorizedGates: authorizedExecutionGates(),
  });
  return resolved.degraded === null && resolved.mode !== "PROSPECT_DEMO";
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
