import "@/lib/serverOnlyGuard";
import { createHash } from "node:crypto";
import { db } from "@/lib/db/client";
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
 * Append-only ingest writer. v0.2 keeps signature_valid = false (no real
 * verification yet). Real provider routing lands in v0.3.
 *
 * Idempotent on the (provider, provider_event_id) dedupe hash: replays
 * return process_status = "duplicate" and do not insert again.
 */
export async function recordWebhookEvent(entry: {
  account_id?: string;
  provider: string;
  provider_event_id: string;
  event_type: string;
  raw_body: string;
  signature_header?: string;
}): Promise<Result<{ id: string; process_status: WebhookProcessStatus }>> {
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
        signature_valid: false,
        dedupe_hash,
        process_status: "received",
      },
      select: { id: true, process_status: true },
    });
    return ok({
      id: created.id,
      process_status: created.process_status as WebhookProcessStatus,
    });
  } catch (e) {
    return errFromThrown<{ id: string; process_status: WebhookProcessStatus }>(
      e,
    );
  }
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
