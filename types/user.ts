import { ISODate, UUID, newId, nowIso } from "./common";

export type UserRole = "aj_admin" | "operator" | "client_admin" | "client_viewer";

export interface User {
  id: UUID;
  account_id?: UUID;
  role: UserRole;
  name: string;
  email: string;
  phone?: string;
  /**
   * 32A — Clerk external identity. Nullable for seeded fixture users
   * (which cannot sign in via Clerk) and for any pre-Clerk row that
   * has not yet been linked. Wiring lands in 32B/32C.
   */
  clerk_user_id?: string;
  created_at: ISODate;
  updated_at: ISODate;
}

export function MockUser(overrides: Partial<User> = {}): User {
  const now = nowIso();
  return {
    id: newId(),
    account_id: undefined,
    role: "client_admin",
    name: "Jane Operator",
    email: "jane@example.com",
    phone: "+15555550111",
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}
