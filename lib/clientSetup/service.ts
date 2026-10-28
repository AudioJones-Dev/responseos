import "@/lib/serverOnlyGuard";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { err, ok, type Result } from "@/lib/data/result";
import { isCrossTenantRole, withTenantScope } from "@/lib/data/session-helpers";
import { buildSetupDraft, CreateSetupSchema, localSetupWritesAllowed, normalizedBusinessName, SetupDraftSchema, UpdateSetupSchema, type SetupDraft } from "./contracts";
import { SYNTHETIC_SETUP } from "./fixture";

export interface SetupView {
  account: { id: string; name: string; slug: string; industry: string; timezone: string; status: string };
  draft: SetupDraft;
  synthetic: boolean;
}
const accountSelect = { id: true, name: true, slug: true, industry: true, timezone: true, status: true, setup_draft_json: true } as const;

export async function readClientSetup(accountId?: string): Promise<Result<SetupView>> {
  const scope = await withTenantScope(accountId);
  if (!scope.ok) return scope;
  const id = scope.effectiveAccountId;
  if (!id) return err("validation_failed", "Choose an account.");
  if (!db) return id === SYNTHETIC_SETUP.account.id
    ? ok(SYNTHETIC_SETUP) : err("not_found", "No setup draft for this account.");
  try {
    const row = await db.account.findUnique({ where: { id }, select: accountSelect });
    if (!row?.setup_draft_json) return err("not_found", "No setup draft for this account.");
    const draft = SetupDraftSchema.safeParse(row.setup_draft_json);
    if (!draft.success || row.status !== "paused") return err("setup_conflict", "This account is outside inactive setup. Reconciliation is required.");
    const { setup_draft_json: _draft, ...account } = row;
    void _draft;
    return ok({ account, draft: draft.data, synthetic: false });
  } catch { return err("internal_error", "Setup could not be read. Check schema readiness."); }
}

export async function createClientSetup(input: unknown): Promise<Result<SetupView>> {
  const scope = await withTenantScope();
  if (!scope.ok) return scope;
  if (!isCrossTenantRole(scope.session)) return err("role_denied", "Operator access is required.");
  if (!localSetupWritesAllowed() || !db) return err("setup_write_blocked", "Setup writes require the dedicated local test database. Production target unresolved.");
  const parsed = CreateSetupSchema.safeParse(input);
  if (!parsed.success) return err("validation_failed", "Business name, slug, industry, timezone, founder and E.164 contact number are required. Only draft fields are accepted.");
  const data = parsed.data;
  try {
    return await db.$transaction(async (tx) => {
      // Serialize setup writers before checking names, slugs and contact numbers.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(190028, 1)`;
      const accounts = await tx.account.findMany({ select: { id: true, name: true, slug: true, primary_phone: true, setup_draft_json: true } });
      if (accounts.some((account) => {
        const draft = SetupDraftSchema.safeParse(account.setup_draft_json);
        return account.slug === data.slug || normalizedBusinessName(account.name) === normalizedBusinessName(data.businessName)
          || account.primary_phone?.replace(/[^+\d]/g, "") === data.contactNumber
          || (draft.success && draft.data.contactNumber === data.contactNumber);
      })) return err("duplicate_account", "A matching account or contact number exists. Reconcile it instead of creating another account.");
      const draft = buildSetupDraft(data, 1);
      const row = await tx.account.create({ data: {
        name: data.businessName, slug: data.slug, industry: data.industry, timezone: data.timezone,
        status: "paused", account_type: "customer", setup_draft_json: draft,
      }, select: accountSelect });
      await tx.auditLog.create({ data: {
        account_id: row.id, actor_user_id: scope.session.user.id, actor_role: scope.session.user.role,
        actor_type: "user", action: "client_setup.created", category: "workflow",
        target_type: "Account", target_id: row.id, reason: "Inactive local setup; no access or provider activation.",
        metadata_json: { revision: 1 },
      } });
      const { setup_draft_json: _draft, ...account } = row;
      void _draft;
      return ok({ account, draft, synthetic: false });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) return err("duplicate_account", "Concurrent or duplicate account creation refused. Reconcile before retrying.");
    return err("internal_error", "Setup was not created. Check local schema readiness.");
  }
}

export async function updateClientSetup(accountId: string, input: unknown): Promise<Result<SetupView>> {
  const scope = await withTenantScope(accountId);
  if (!scope.ok) return scope;
  if (!isCrossTenantRole(scope.session)) return err("role_denied", "Only operators may edit setup drafts.");
  if (!localSetupWritesAllowed() || !db) return err("setup_write_blocked", "Setup writes require the dedicated local test database. Production target unresolved.");
  const parsed = UpdateSetupSchema.safeParse(input);
  if (!parsed.success) return err("validation_failed", "Provide the current revision and draft fields only.");
  try {
    return await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(190028, 1)`;
      const row = await tx.account.findUnique({ where: { id: scope.effectiveAccountId! }, select: accountSelect });
      if (!row) return err("not_found", "Account not found.");
      const old = SetupDraftSchema.safeParse(row.setup_draft_json);
      if (!old.success || row.status !== "paused" || old.data.revision !== parsed.data.revision) return err("setup_conflict", "Draft changed or account is outside inactive setup. Reload and reconcile.");
      const others = await tx.account.findMany({ where: { id: { not: row.id } }, select: { primary_phone: true, setup_draft_json: true } });
      if (others.some((account) => {
        const other = SetupDraftSchema.safeParse(account.setup_draft_json);
        return account.primary_phone?.replace(/[^+\d]/g, "") === parsed.data.draft.contactNumber
          || (other.success && other.data.contactNumber === parsed.data.draft.contactNumber);
      })) return err("duplicate_account", "This contact number belongs to another account record. Reconcile before saving.");
      const draft = buildSetupDraft(parsed.data.draft, old.data.revision + 1);
      await tx.account.update({ where: { id: row.id }, data: { setup_draft_json: draft } });
      await tx.auditLog.create({ data: {
        account_id: row.id, actor_user_id: scope.session.user.id, actor_role: scope.session.user.role,
        actor_type: "user", action: "client_setup.draft_updated", category: "workflow",
        target_type: "Account", target_id: row.id, reason: "Draft only; receptionist publication remains blocked.",
        metadata_json: { previousRevision: old.data.revision, revision: draft.revision },
      } });
      const { setup_draft_json: _draft, ...account } = row;
      void _draft;
      return ok({ account, draft, synthetic: false });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch { return err("setup_conflict", "Draft was not saved. Reload before retrying."); }
}
