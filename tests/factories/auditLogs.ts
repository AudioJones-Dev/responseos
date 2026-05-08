import type { Prisma } from "@prisma/client";
import { nextTestId } from "./ids";

export function makeAuditLog(
  params: { organizationId?: string | null; actorUserId?: string | null },
  overrides: Partial<Prisma.AuditLogCreateInput> = {},
): Prisma.AuditLogCreateInput {
  const base: Prisma.AuditLogCreateInput = {
    id: overrides.id ?? nextTestId("audit"),
    organization_id: params.organizationId ?? null,
    actor_user_id: params.actorUserId ?? null,
    actor_type: "user",
    action: "test.action",
    target_type: "TestTarget",
    target_id: "target_test_001",
    metadata_json: { source: "factory" },
    ip_address: "127.0.0.1",
    user_agent: "vitest",
  };
  return { ...base, ...overrides };
}
