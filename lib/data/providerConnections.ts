import "@/lib/serverOnlyGuard";
import { db } from "@/lib/db/client";
import { getMockProviderConnections } from "@/lib/mock/providerConnections";
import type {
  ProviderConnection,
  ProviderConnectionProvider,
  ProviderConnectionStatus,
} from "@/types/providerConnection";
import { err, errFromThrown, ok, type Result } from "./result";
import { isCrossTenantRole, withTenantScope } from "./session-helpers";

interface ProviderConnectionRow {
  id: string;
  account_id: string;
  provider: string;
  // credentials_encrypted intentionally NOT projected to the public shape.
  // Decryption happens at the provider-adapter boundary per ADR-0020.
  status: string;
  scopes: string[];
  connected_by: string;
  last_verified_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function rowToProviderConnection(row: ProviderConnectionRow): ProviderConnection {
  return {
    id: row.id,
    account_id: row.account_id,
    provider: row.provider as ProviderConnectionProvider,
    status: row.status as ProviderConnectionStatus,
    scopes: row.scopes,
    connected_by: row.connected_by,
    last_verified_at: row.last_verified_at?.toISOString(),
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

/**
 * Project columns excluding `credentials_encrypted` and
 * `oauth_refresh_token_encrypted` — ciphertext never leaves the data
 * layer through this accessor. Decryption is the provider-adapter's job.
 */
const PUBLIC_SELECT = {
  id: true,
  account_id: true,
  provider: true,
  status: true,
  scopes: true,
  connected_by: true,
  last_verified_at: true,
  created_at: true,
  updated_at: true,
} as const;

export async function listProviderConnections(params: {
  accountId?: string;
}): Promise<Result<ProviderConnection[]>> {
  const scope = await withTenantScope(params.accountId);
  if (!scope.ok) return err(scope.error.code, scope.error.message);

  if (db === null) {
    const all = getMockProviderConnections();
    if (scope.effectiveAccountId) {
      return ok(all.filter((c) => c.account_id === scope.effectiveAccountId));
    }
    return ok(all);
  }

  try {
    const rows = await db.providerConnection.findMany({
      where: scope.effectiveAccountId
        ? { account_id: scope.effectiveAccountId }
        : undefined,
      select: PUBLIC_SELECT,
      orderBy: { provider: "asc" },
    });
    return ok(rows.map(rowToProviderConnection));
  } catch (e) {
    return errFromThrown<ProviderConnection[]>(e);
  }
}

export async function getProviderConnectionByProvider(params: {
  accountId: string;
  provider: ProviderConnectionProvider;
}): Promise<Result<ProviderConnection | null>> {
  const scope = await withTenantScope(params.accountId);
  if (!scope.ok) return err(scope.error.code, scope.error.message);

  const effective = scope.effectiveAccountId ?? params.accountId;

  if (db === null) {
    const found = getMockProviderConnections().find(
      (c) => c.account_id === effective && c.provider === params.provider,
    );
    if (!found) return ok(null);
    if (
      !isCrossTenantRole(scope.session) &&
      found.account_id !== scope.effectiveAccountId
    ) {
      return err(
        "tenant_scope_denied",
        "Caller is not in the resource's tenant scope.",
      );
    }
    return ok(found);
  }

  try {
    const row = await db.providerConnection.findUnique({
      where: { account_id_provider: { account_id: effective, provider: params.provider } },
      select: PUBLIC_SELECT,
    });
    if (!row) return ok(null);
    if (
      !isCrossTenantRole(scope.session) &&
      row.account_id !== scope.effectiveAccountId
    ) {
      return err(
        "tenant_scope_denied",
        "Caller is not in the resource's tenant scope.",
      );
    }
    return ok(rowToProviderConnection(row));
  } catch (e) {
    return errFromThrown<ProviderConnection | null>(e);
  }
}
