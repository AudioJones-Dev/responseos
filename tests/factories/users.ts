import type { Prisma, UserRole } from "@prisma/client";
import { nextTestId } from "./ids";

export function makeUser(
  params: { role: UserRole; accountId?: string | null },
  overrides: Partial<Prisma.UserCreateInput> = {},
): Prisma.UserCreateInput {
  const id = overrides.id ?? nextTestId("user");
  const base: Prisma.UserCreateInput = {
    id,
    account_id: params.accountId ?? null,
    role: params.role,
    name: `Test User ${id}`,
    email: `${id}@example.test`,
    phone: "+15555558888",
  };
  return { ...base, ...overrides };
}
