import "@/lib/serverOnlyGuard";
import { db } from "@/lib/db/client";
import { getMockSmsMessages } from "@/lib/mock/smsMessages";
import type {
  SmsDirection,
  SmsMessage,
  SmsMessageStatus,
  SmsProvider,
} from "@/types/smsMessage";
import { err, errFromThrown, ok, type Result } from "./result";
import { isCrossTenantRole, withTenantScope } from "./session-helpers";

interface SmsMessageRow {
  id: string;
  account_id: string;
  conversation_id: string;
  provider: string;
  provider_message_id: string | null;
  direction: string;
  from_number: string;
  to_number: string;
  body: string;
  status: string;
  segment_count: number;
  error_code: string | null;
  error_message: string | null;
  sent_at: Date | null;
  delivered_at: Date | null;
  created_at: Date;
}

function rowToSmsMessage(row: SmsMessageRow): SmsMessage {
  return {
    id: row.id,
    account_id: row.account_id,
    conversation_id: row.conversation_id,
    provider: row.provider as SmsProvider,
    provider_message_id: row.provider_message_id ?? undefined,
    direction: row.direction as SmsDirection,
    from_number: row.from_number,
    to_number: row.to_number,
    body: row.body,
    status: row.status as SmsMessageStatus,
    segment_count: row.segment_count,
    error_code: row.error_code ?? undefined,
    error_message: row.error_message ?? undefined,
    sent_at: row.sent_at?.toISOString(),
    delivered_at: row.delivered_at?.toISOString(),
    created_at: row.created_at.toISOString(),
  };
}

export async function listSmsMessagesByConversation(params: {
  accountId: string;
  conversationId: string;
}): Promise<Result<SmsMessage[]>> {
  const scope = await withTenantScope(params.accountId);
  if (!scope.ok) return err(scope.error.code, scope.error.message);

  if (db === null) {
    const all = getMockSmsMessages().filter(
      (m) => m.conversation_id === params.conversationId,
    );
    if (
      !isCrossTenantRole(scope.session) &&
      scope.effectiveAccountId !== undefined
    ) {
      return ok(all.filter((m) => m.account_id === scope.effectiveAccountId));
    }
    return ok(all);
  }

  try {
    const rows = await db.smsMessage.findMany({
      where: {
        conversation_id: params.conversationId,
        ...(scope.effectiveAccountId
          ? { account_id: scope.effectiveAccountId }
          : {}),
      },
      orderBy: { created_at: "asc" },
    });
    return ok(rows.map(rowToSmsMessage));
  } catch (e) {
    return errFromThrown<SmsMessage[]>(e);
  }
}

/**
 * Append-only writer for SMS messages. Idempotent on
 * `(provider, provider_message_id)` — a duplicate webhook delivery with
 * the same MessageSid is a no-op (returns the existing row), satisfying
 * ADR-0009's replay-safety rule.
 */
export async function recordSmsMessage(entry: {
  account_id: string;
  conversation_id: string;
  provider: SmsProvider;
  provider_message_id?: string | null;
  direction: SmsDirection;
  from_number: string;
  to_number: string;
  body: string;
  status: SmsMessageStatus;
  segment_count?: number;
  error_code?: string | null;
  error_message?: string | null;
  sent_at?: Date | null;
  delivered_at?: Date | null;
}): Promise<Result<SmsMessage>> {
  if (db === null) {
    return err(
      "not_available",
      "recordSmsMessage requires a database connection.",
    );
  }

  try {
    if (entry.provider_message_id) {
      const existing = await db.smsMessage.findUnique({
        where: {
          provider_provider_message_id: {
            provider: entry.provider,
            provider_message_id: entry.provider_message_id,
          },
        },
      });
      if (existing) {
        return ok(rowToSmsMessage(existing));
      }
    }
    const created = await db.smsMessage.create({
      data: {
        account_id: entry.account_id,
        conversation_id: entry.conversation_id,
        provider: entry.provider,
        provider_message_id: entry.provider_message_id ?? null,
        direction: entry.direction,
        from_number: entry.from_number,
        to_number: entry.to_number,
        body: entry.body,
        status: entry.status,
        segment_count: entry.segment_count ?? 1,
        error_code: entry.error_code ?? null,
        error_message: entry.error_message ?? null,
        sent_at: entry.sent_at ?? null,
        delivered_at: entry.delivered_at ?? null,
      },
    });
    return ok(rowToSmsMessage(created));
  } catch (e) {
    return errFromThrown<SmsMessage>(e);
  }
}
