import type { Prisma } from "@prisma/client";
import { nextTestId } from "./ids";

// Mock-sentinel bytes per ADR-0020. Stored verbatim in the
// `credentials_encrypted` column when no `RESPONSEOS_PROVIDER_KEY` is set.
const MOCK_SENTINEL_BYTES = Buffer.from("<MOCK_REDACTED>", "utf8");

export function makeProviderConnection(
  params: { accountId: string; connectedBy: string },
  overrides: Partial<Prisma.ProviderConnectionCreateInput> = {},
): Prisma.ProviderConnectionCreateInput {
  const id = overrides.id ?? nextTestId("pconn");
  const base: Prisma.ProviderConnectionCreateInput = {
    id,
    account_id: params.accountId,
    provider: "twilio",
    credentials_encrypted: MOCK_SENTINEL_BYTES,
    status: "connected",
    scopes: [],
    connected_by: params.connectedBy,
    last_verified_at: new Date("2026-05-04T14:30:00.000Z"),
  };
  return { ...base, ...overrides };
}
