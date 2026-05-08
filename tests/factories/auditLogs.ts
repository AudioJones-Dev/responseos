import type { Prisma } from "@prisma/client";

let auditLogCounter = 0;

export function makeAuditLog(
  params: { organizationId?: string | null; actorUserId?: string | null },
  overrides: Partial<Prisma.AuditLogCreateInput> = {},
): Prisma.AuditLogCreateInput {
  auditLogCounter += 1;
  const suffix = auditLogCounter.toString().padStart(3, "0");

  return {
    id: `audit_test_${suffix}`,
    organization_id: params.organizationId ?? null,
    actor_user_id: params.actorUserId ?? null,
    actor_type: params.actorUserId ? "user" : "system",
    action: "test.action",
    target_type: "TestTarget",
    target_id: `target_test_${suffix}`,
    metadata_json: { deterministic: true },
    ip_address: "127.0.0.1",
    user_agent: "vitest",
    ...overrides,
  };
}
