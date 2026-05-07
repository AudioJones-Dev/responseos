import "@/lib/serverOnlyGuard";
import { db } from "@/lib/db/client";
import { getMockOrganizations } from "@/lib/mock/organizations";
import type { Organization } from "@/types/organization";
import { err, errFromThrown, ok, type Result } from "./result";
import {
  assertRowInScope,
  isCrossTenantRole,
  withTenantScope,
} from "./session-helpers";

function rowToOrganization(row: {
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
}): Organization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    industry: row.industry,
    website_url: row.website_url ?? undefined,
    primary_phone: row.primary_phone ?? undefined,
    timezone: row.timezone,
    status: row.status as Organization["status"],
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export async function listOrganizations(): Promise<Result<Organization[]>> {
  const scope = await withTenantScope(undefined);
  if (!scope.ok) return err(scope.error.code, scope.error.message);

  // Tenant users only ever see their own org via this accessor.
  if (!isCrossTenantRole(scope.session) && scope.effectiveOrgId) {
    const single = await getOrganizationById(scope.effectiveOrgId);
    if (!single.ok) return single;
    return ok([single.data]);
  }

  if (db === null) {
    return ok(getMockOrganizations());
  }

  try {
    const rows = await db.organization.findMany({ orderBy: { created_at: "asc" } });
    return ok(rows.map(rowToOrganization));
  } catch (e) {
    return errFromThrown<Organization[]>(e);
  }
}

export async function getOrganizationById(
  id: string,
): Promise<Result<Organization>> {
  const scope = await withTenantScope(id);
  if (!scope.ok) return err(scope.error.code, scope.error.message);

  if (db === null) {
    const found = getMockOrganizations().find((o) => o.id === id);
    if (!found) return err("not_found", `Organization ${id} not found.`);
    return assertRowInScope(
      { ...found, organization_id: found.id },
      scope.effectiveOrgId,
      isCrossTenantRole(scope.session),
    ).ok
      ? ok(found)
      : err(
          "tenant_scope_denied",
          "Caller is not in the resource's tenant scope.",
        );
  }

  try {
    const row = await db.organization.findUnique({ where: { id } });
    if (!row) return err("not_found", `Organization ${id} not found.`);
    const org = rowToOrganization(row);
    const scoped = assertRowInScope(
      { ...org, organization_id: org.id },
      scope.effectiveOrgId,
      isCrossTenantRole(scope.session),
    );
    return scoped.ok ? ok(org) : err(scoped.error.code, scoped.error.message);
  } catch (e) {
    return errFromThrown<Organization>(e);
  }
}
