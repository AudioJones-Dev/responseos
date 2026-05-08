import type { Prisma, UserRole } from "@prisma/client";

let userCounter = 0;

export function makeUser(
  params: { role: UserRole; organizationId?: string | null },
  overrides: Partial<Prisma.UserCreateInput> = {},
): Prisma.UserCreateInput {
  userCounter += 1;
  const suffix = userCounter.toString().padStart(3, "0");

  return {
    id: `user_test_${suffix}`,
    organization_id: params.organizationId ?? null,
    role: params.role,
    name: `Test User ${suffix}`,
    email: `user-test-${suffix}@example.com`,
    phone: `+1555200${suffix}`,
    ...overrides,
  };
}
