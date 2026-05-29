import "@/lib/serverOnlyGuard";
import { db } from "@/lib/db/client";
import { getMockAccounts } from "@/lib/mock/accounts";
import type { Account } from "@/types/account";
import { err, errFromThrown, ok, type Result } from "./result";
import {
  assertRowInScope,
  isCrossTenantRole,
  withTenantScope,
} from "./session-helpers";

function rowToAccount(row: {
  id: string;
  name: string;
  slug: string;
  industry: string;
  website_url: string | null;
  primary_phone: string | null;
  timezone: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}): Account {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    industry: row.industry,
    website_url: row.website_url ?? undefined,
    primary_phone: row.primary_phone ?? undefined,
    timezone: row.timezone,
    status: row.status as Account["status"],
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export async function listAccounts(): Promise<Result<Account[]>> {
  const scope = await withTenantScope(undefined);
  if (!scope.ok) return err(scope.error.code, scope.error.message);

  // Tenant users only ever see their own org via this accessor.
  if (!isCrossTenantRole(scope.session) && scope.effectiveAccountId) {
    const single = await getAccountById(scope.effectiveAccountId);
    if (!single.ok) return single;
    return ok([single.data]);
  }

  if (db === null) {
    return ok(getMockAccounts());
  }

  try {
    const rows = await db.account.findMany({ orderBy: { created_at: "asc" } });
    return ok(rows.map(rowToAccount));
  } catch (e) {
    return errFromThrown<Account[]>(e);
  }
}

export async function getAccountById(
  id: string,
): Promise<Result<Account>> {
  const scope = await withTenantScope(id);
  if (!scope.ok) return err(scope.error.code, scope.error.message);

  if (db === null) {
    const found = getMockAccounts().find((o) => o.id === id);
    if (!found) return err("not_found", `Account ${id} not found.`);
    return assertRowInScope(
      { ...found, account_id: found.id },
      scope.effectiveAccountId,
      isCrossTenantRole(scope.session),
    ).ok
      ? ok(found)
      : err(
          "tenant_scope_denied",
          "Caller is not in the resource's tenant scope.",
        );
  }

  try {
    const row = await db.account.findUnique({ where: { id } });
    if (!row) return err("not_found", `Account ${id} not found.`);
    const org = rowToAccount(row);
    const scoped = assertRowInScope(
      { ...org, account_id: org.id },
      scope.effectiveAccountId,
      isCrossTenantRole(scope.session),
    );
    return scoped.ok ? ok(org) : err(scoped.error.code, scoped.error.message);
  } catch (e) {
    return errFromThrown<Account>(e);
  }
}
