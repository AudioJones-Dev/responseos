import "@/lib/serverOnlyGuard";
import { db } from "@/lib/db/client";
import { getMockContacts } from "@/lib/mock/contacts";
import type { Contact, ContactSource } from "@/types/contact";
import { err, errFromThrown, ok, type Result } from "./result";
import {
  assertRowInScope,
  isCrossTenantRole,
  withTenantScope,
} from "./session-helpers";

interface ContactRow {
  id: string;
  organization_id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  source: string;
  created_at: Date;
  updated_at: Date;
}

function rowToContact(row: ContactRow): Contact {
  return {
    id: row.id,
    organization_id: row.organization_id,
    first_name: row.first_name ?? undefined,
    last_name: row.last_name ?? undefined,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    address: row.address ?? undefined,
    city: row.city ?? undefined,
    state: row.state ?? undefined,
    zip: row.zip ?? undefined,
    source: row.source as ContactSource,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export async function listContacts(params: {
  organizationId?: string;
}): Promise<Result<Contact[]>> {
  const scope = await withTenantScope(params.organizationId);
  if (!scope.ok) return err(scope.error.code, scope.error.message);

  if (db === null) {
    const all = getMockContacts();
    if (scope.effectiveOrgId) {
      return ok(all.filter((c) => c.organization_id === scope.effectiveOrgId));
    }
    return ok(all);
  }

  try {
    const rows = await db.contact.findMany({
      where: scope.effectiveOrgId
        ? { organization_id: scope.effectiveOrgId }
        : undefined,
      orderBy: { created_at: "asc" },
    });
    return ok(rows.map(rowToContact));
  } catch (e) {
    return errFromThrown<Contact[]>(e);
  }
}

export async function getContactById(id: string): Promise<Result<Contact>> {
  const scope = await withTenantScope(undefined);
  if (!scope.ok) return err(scope.error.code, scope.error.message);

  if (db === null) {
    const found = getMockContacts().find((c) => c.id === id);
    if (!found) return err("not_found", `Contact ${id} not found.`);
    const scoped = assertRowInScope(
      found,
      scope.effectiveOrgId,
      isCrossTenantRole(scope.session),
    );
    return scoped.ok ? ok(found) : err(scoped.error.code, scoped.error.message);
  }

  try {
    const row = await db.contact.findUnique({ where: { id } });
    if (!row) return err("not_found", `Contact ${id} not found.`);
    const contact = rowToContact(row);
    const scoped = assertRowInScope(
      contact,
      scope.effectiveOrgId,
      isCrossTenantRole(scope.session),
    );
    return scoped.ok
      ? ok(contact)
      : err(scoped.error.code, scoped.error.message);
  } catch (e) {
    return errFromThrown<Contact>(e);
  }
}
