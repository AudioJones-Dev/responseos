import "@/lib/serverOnlyGuard";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db, db as database } from "@/lib/db/client";
import { err, errFromThrown, ok, type Result } from "./result";
import { requireRole } from "@/lib/auth/session";

export type WebhookProcessStatus =
  | "received"
  | "processed"
  | "rejected"
  | "duplicate"
  | "error";

export interface WebhookEvent {
  id: string;
  account_id?: string;
  provider: string;
  provider_event_id: string;
  event_type: string;
  raw_body: string;
  signature_header?: string;
  signature_valid: boolean;
  dedupe_hash: string;
  received_at: string;
  processed_at?: string;
  process_status: WebhookProcessStatus;
  process_error?: string;
  payload_expires_at?: string;
  payload_purged_at?: string;
}

interface WebhookRow {
  id: string;
  account_id: string | null;
  provider: string;
  provider_event_id: string;
  event_type: string;
  raw_body: string;
  signature_header: string | null;
  signature_valid: boolean;
  dedupe_hash: string;
  received_at: Date;
  processed_at: Date | null;
  process_status: string;
  process_error: string | null;
  payload_expires_at: Date | null;
  payload_purged_at: Date | null;
}

function rowToWebhook(row: WebhookRow): WebhookEvent {
  return {
    id: row.id,
    account_id: row.account_id ?? undefined,
    provider: row.provider,
    provider_event_id: row.provider_event_id,
    event_type: row.event_type,
    raw_body: row.raw_body,
    signature_header: row.signature_header ?? undefined,
    signature_valid: row.signature_valid,
    dedupe_hash: row.dedupe_hash,
    received_at: row.received_at.toISOString(),
    processed_at: row.processed_at
      ? row.processed_at.toISOString()
      : undefined,
    process_status: row.process_status as WebhookProcessStatus,
    process_error: row.process_error ?? undefined,
    payload_expires_at: row.payload_expires_at?.toISOString(),
    payload_purged_at: row.payload_purged_at?.toISOString(),
  };
}

export function computeDedupeHash(
  provider: string,
  providerEventId: string,
): string {
  return createHash("sha256")
    .update(`${provider}:${providerEventId}`)
    .digest("hex");
}

/**
 * Append-only ingest writer. `signature_valid` defaults to false; callers that
 * verify the signature before recording (the Clerk webhook handler, ADR-0009)
 * pass `signature_valid: true`.
 *
 * Idempotent on the (provider, provider_event_id) dedupe hash: replays
 * return process_status = "duplicate" and do not insert again.
 */
export async function recordWebhookEvent(entry: {
  client?: Prisma.TransactionClient;
  account_id?: string;
  provider: string;
  provider_event_id: string;
  event_type: string;
  raw_body: string;
  signature_header?: string;
  signature_valid?: boolean;
  payload_expires_at?: Date;
  provider_call_id?: string;
  provider_call_ids?: readonly string[];
  agent_target?: string;
}): Promise<Result<{ id: string; process_status: WebhookProcessStatus }>> {
  const db = entry.client ?? database;
  if (db === null) {
    return err(
      "no_database",
      "Webhook ingest requires DATABASE_URL to be set.",
    );
  }

  const dedupe_hash = computeDedupeHash(entry.provider, entry.provider_event_id);

  try {
    const existing = await db.webhookEvent.findUnique({
      where: { dedupe_hash },
      select: { id: true },
    });
    if (existing) {
      return ok({ id: existing.id, process_status: "duplicate" });
    }

    const created = await db.webhookEvent.create({
      data: {
        account_id: entry.account_id ?? null,
        provider: entry.provider,
        provider_event_id: entry.provider_event_id,
        event_type: entry.event_type,
        raw_body: entry.raw_body,
        signature_header: entry.signature_header ?? null,
        signature_valid: entry.signature_valid ?? false,
        dedupe_hash,
        process_status: "received",
        payload_expires_at: entry.payload_expires_at ?? null,
        provider_call_id: entry.provider_call_id ?? null,
        provider_call_ids: [...new Set([...(entry.provider_call_ids ?? []), ...(entry.provider_call_id ? [entry.provider_call_id] : [])])],
        agent_target: entry.agent_target ?? null,
      },
      select: { id: true, process_status: true },
    });
    return ok({
      id: created.id,
      process_status: created.process_status as WebhookProcessStatus,
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      const existing = await db.webhookEvent.findUnique({
        where: { dedupe_hash },
        select: { id: true },
      });
      if (existing) return ok({ id: existing.id, process_status: "duplicate" });
    }
    return errFromThrown<{ id: string; process_status: WebhookProcessStatus }>(
      e,
    );
  }
}

/**
 * Recovers the called number for a provider event that omits it.
 *
 * Telnyx sends conversation-insight events with call-control identifiers only:
 * no `to`, no `telnyx_agent_target`. The number arrived on an earlier signed
 * event for the same call (the assistant initialization, and the conversation
 * end), so the ledger is the authority for which tenant the call belongs to.
 * Reads only rows this provider already recorded; never guesses.
 */
export interface CallCorrelation {
  target: string;
  /**
   * The moment the call reached the number, taken from the earliest signed
   * event that carried it (the initialization). A later post-call event must
   * be resolved at this time, not its own: the number may have been released
   * or reassigned in between, and the call belongs to whoever held it then.
   */
  anchoredAt: Date;
}

function occurredAtFromRawBody(rawBody: string): Date | null {
  try {
    const value = (JSON.parse(rawBody) as { data?: { occurred_at?: unknown } }).data?.occurred_at;
    if (typeof value !== "string") return null;
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  } catch {
    return null;
  }
}

export async function findCallCorrelation(params: {
  provider: string;
  providerCallIds: readonly string[];
}): Promise<CallCorrelation | null> {
  if (db === null) return null;
  const providerCallIds = params.providerCallIds.filter((value) => typeof value === "string" && value.length > 0);
  if (providerCallIds.length === 0) return null;
  const rows = await db.webhookEvent.findMany({
    where: {
      provider: params.provider,
      OR: [{ provider_call_id: { in: [...providerCallIds] } }, { provider_call_ids: { hasSome: [...providerCallIds] } }],
      agent_target: { not: null },
      signature_valid: true,
    },
    orderBy: { received_at: "asc" },
    select: { agent_target: true, raw_body: true, received_at: true },
  });
  const earliest = rows[0];
  if (!earliest?.agent_target) return null;
  if (rows.some((row) => row.agent_target !== earliest.agent_target)) return null;
  return { target: earliest.agent_target, anchoredAt: occurredAtFromRawBody(earliest.raw_body) ?? earliest.received_at };
}

export async function findAgentTargetForProviderCall(params: {
  provider: string;
  providerCallIds: readonly string[];
}): Promise<string | null> {
  return (await findCallCorrelation(params))?.target ?? null;
}

export async function findInitializedProviderCallId(params: { provider: string; providerCallIds: readonly string[]; target: string }): Promise<string | null> {
  if (!db || params.providerCallIds.length === 0) return null;
  const exact = await db.webhookEvent.findFirst({
    where: { provider: params.provider, event_type: "assistant.initialization", signature_valid: true, agent_target: params.target, provider_call_id: { in: [...params.providerCallIds] } },
    select: { provider_call_id: true },
  });
  if (exact?.provider_call_id) return exact.provider_call_id;
  const row = await db.webhookEvent.findFirst({
    where: { provider: params.provider, event_type: "assistant.initialization", signature_valid: true, agent_target: params.target,
      OR: [{ provider_call_id: { in: [...params.providerCallIds] } }, { provider_call_ids: { hasSome: [...params.providerCallIds] } }],
    },
    orderBy: { received_at: "asc" }, select: { provider_call_id: true },
  });
  if (!row?.provider_call_id) return null;
  const conflict = await db.webhookEvent.findFirst({
    where: { provider: params.provider, event_type: "assistant.initialization", signature_valid: true, agent_target: params.target,
      provider_call_id: { not: row.provider_call_id }, provider_call_ids: { hasSome: [...params.providerCallIds] },
    }, select: { id: true },
  });
  return conflict ? null : row.provider_call_id;
}

export async function purgeExpiredWebhookPayloads(now = new Date()): Promise<Result<{ purged: number }>> {
  if (db === null) return err("no_database", "Webhook payload purge requires DATABASE_URL.");
  try {
    const result = await db.webhookEvent.updateMany({
      where: {
        payload_expires_at: { lte: now },
        payload_purged_at: null,
      },
      data: {
        raw_body: "<PURGED_WEBHOOK_PAYLOAD>",
        signature_header: null,
        process_error: null,
        payload_purged_at: now,
      },
    });
    return ok({ purged: result.count });
  } catch (error) {
    return errFromThrown(error);
  }
}

export async function setWebhookProcessStatus(params: {
  client?: Prisma.TransactionClient;
  id: string;
  process_status: "processed" | "rejected" | "error";
  process_error?: string;
}): Promise<void> {
  const db = params.client ?? database;
  if (db === null) return;
  await db.webhookEvent.update({
    where: { id: params.id },
    data: {
      process_status: params.process_status,
      process_error: params.process_error?.slice(0, 500) ?? null,
      processed_at: new Date(),
    },
  });
}

/**
 * Scopes a ledger row that was recorded before its call could be correlated.
 *
 * The first delivery of an uncorrelated event is stored unscoped and on the
 * prospect expiry clock. Once a redelivery resolves the tenant, the row must
 * carry that tenant, its retention policy, and the body that policy permits
 * before it is normalized — otherwise supervised evidence sits unscoped and
 * scheduled for purge.
 */
export async function backfillWebhookEvent(entry: {
  client?: Prisma.TransactionClient;
  id: string;
  account_id: string;
  raw_body: string;
  payload_expires_at: Date | null;
  provider_call_id?: string;
  provider_call_ids?: readonly string[];
  agent_target?: string;
}): Promise<void> {
  const client = entry.client ?? db;
  if (client === null) return;
  const current = await client.webhookEvent.findUnique({ where: { id: entry.id }, select: { provider_call_ids: true } });
  await client.webhookEvent.update({
    where: { id: entry.id },
    data: {
      account_id: entry.account_id,
      raw_body: entry.raw_body,
      payload_expires_at: entry.payload_expires_at,
      provider_call_id: entry.provider_call_id ?? undefined,
      provider_call_ids: [...new Set([...(current?.provider_call_ids ?? []), ...(entry.provider_call_ids ?? []), ...(entry.provider_call_id ? [entry.provider_call_id] : [])])],
      agent_target: entry.agent_target ?? undefined,
    },
  });
}

export async function getWebhookProcessingState(id: string): Promise<
  | { process_status: WebhookProcessStatus; process_error: string | null; received_at: Date }
  | null
> {
  if (db === null) return null;
  const event = await db.webhookEvent.findUnique({
    where: { id },
    select: { process_status: true, process_error: true, received_at: true },
  });
  return event
    ? {
        process_status: event.process_status as WebhookProcessStatus,
        process_error: event.process_error,
        received_at: event.received_at,
      }
    : null;
}

/**
 * Admin-only diagnostic reader. Tenant users never see the webhook ledger.
 */
export async function listWebhookEvents(params: {
  provider?: string;
  process_status?: WebhookProcessStatus;
  limit?: number;
}): Promise<Result<WebhookEvent[]>> {
  try {
    await requireRole(["aj_admin", "operator"]);
  } catch (e) {
    return errFromThrown<WebhookEvent[]>(e);
  }

  if (db === null) {
    return ok([]);
  }

  try {
    const rows = await db.webhookEvent.findMany({
      where: {
        ...(params.provider ? { provider: params.provider } : {}),
        ...(params.process_status
          ? { process_status: params.process_status }
          : {}),
      },
      orderBy: { received_at: "desc" },
      take: params.limit ?? 100,
    });
    return ok(rows.map(rowToWebhook));
  } catch (e) {
    return errFromThrown<WebhookEvent[]>(e);
  }
}
