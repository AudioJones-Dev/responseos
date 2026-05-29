import "@/lib/serverOnlyGuard";
import { db } from "@/lib/db/client";
import { getMockConversations } from "@/lib/mock/conversations";
import type { Conversation, ConversationStatus } from "@/types/conversation";
import { err, errFromThrown, ok, type Result } from "./result";
import { isCrossTenantRole, withTenantScope } from "./session-helpers";

interface ConversationRow {
  id: string;
  account_id: string;
  contact_id: string | null;
  business_number: string;
  peer_number: string;
  status: string;
  last_message_at: Date;
  created_at: Date;
  updated_at: Date;
}

function rowToConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    account_id: row.account_id,
    contact_id: row.contact_id ?? undefined,
    business_number: row.business_number,
    peer_number: row.peer_number,
    status: row.status as ConversationStatus,
    last_message_at: row.last_message_at.toISOString(),
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export async function listConversations(params: {
  accountId?: string;
}): Promise<Result<Conversation[]>> {
  const scope = await withTenantScope(params.accountId);
  if (!scope.ok) return err(scope.error.code, scope.error.message);

  if (db === null) {
    const all = getMockConversations();
    if (scope.effectiveAccountId) {
      return ok(all.filter((c) => c.account_id === scope.effectiveAccountId));
    }
    return ok(all);
  }

  try {
    const rows = await db.conversation.findMany({
      where: scope.effectiveAccountId
        ? { account_id: scope.effectiveAccountId }
        : undefined,
      orderBy: { last_message_at: "desc" },
    });
    return ok(rows.map(rowToConversation));
  } catch (e) {
    return errFromThrown<Conversation[]>(e);
  }
}

export async function getConversationById(id: string): Promise<Result<Conversation>> {
  const scope = await withTenantScope(undefined);
  if (!scope.ok) return err(scope.error.code, scope.error.message);

  if (db === null) {
    const found = getMockConversations().find((c) => c.id === id);
    if (!found) return err("not_found", `Conversation ${id} not found.`);
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
    const row = await db.conversation.findUnique({ where: { id } });
    if (!row) return err("not_found", `Conversation ${id} not found.`);
    if (
      !isCrossTenantRole(scope.session) &&
      row.account_id !== scope.effectiveAccountId
    ) {
      return err(
        "tenant_scope_denied",
        "Caller is not in the resource's tenant scope.",
      );
    }
    return ok(rowToConversation(row));
  } catch (e) {
    return errFromThrown<Conversation>(e);
  }
}

/**
 * Find an existing conversation by `(accountId, businessNumber, peerNumber)`
 * or create one. Idempotent — calling twice with the same key returns the
 * same row. This is the write path the future Twilio SMS ingest webhook
 * will call once live wiring lands in v0.3.
 */
export async function findOrCreateConversation(params: {
  accountId: string;
  businessNumber: string;
  peerNumber: string;
  contactId?: string;
  now?: Date;
}): Promise<Result<Conversation>> {
  if (db === null) {
    return err(
      "not_available",
      "findOrCreateConversation requires a database connection.",
    );
  }

  const lastMessageAt = params.now ?? new Date();
  try {
    const row = await db.conversation.upsert({
      where: {
        account_id_business_number_peer_number: {
          account_id: params.accountId,
          business_number: params.businessNumber,
          peer_number: params.peerNumber,
        },
      },
      update: {},
      create: {
        account_id: params.accountId,
        business_number: params.businessNumber,
        peer_number: params.peerNumber,
        contact_id: params.contactId ?? null,
        status: "open",
        last_message_at: lastMessageAt,
      },
    });
    return ok(rowToConversation(row));
  } catch (e) {
    return errFromThrown<Conversation>(e);
  }
}
