import type { Prisma, UserRole } from "@prisma/client";
import { nextTestId } from "./ids";

export function makeUser(
  params: { role: UserRole; organizationId?: string | null },
  overrides: Partial<Prisma.UserCreateInput> = {},
): Prisma.UserCreateInput {
  const id = overrides.id ?? nextTestId("user");
  const base: Prisma.UserCreateInput = {
    id,
    organization_id: params.organizationId ?? null,
    role: params.role,
    name: `Test User ${id}`,
    email: `${id}@example.test`,
    phone: "+15555558888",
  };
  return { ...base, ...overrides };
}
