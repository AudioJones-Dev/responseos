import "@/lib/serverOnlyGuard";
import { db } from "@/lib/db/client";
import { getMockCallTranscripts } from "@/lib/mock/callTranscripts";
import type {
  CallTranscript,
  TranscriptRetentionLane,
} from "@/types/callTranscript";
import { err, errFromThrown, ok, type Result } from "./result";
import { isCrossTenantRole, withTenantScope } from "./session-helpers";

interface CallTranscriptRow {
  id: string;
  account_id: string;
  call_id: string;
  // raw_ref and redacted_ref are intentionally NOT in this row shape
  // because the Prisma `select` below excludes them. Privileged raw-
  // transcript read lands after 31D ships
  // `audit_logs.category = "break_glass"`; see ADR-0019 step 2.3 and
  // planning artifact Q7.
  inline_text: string | null;
  language: string;
  retention_lane: string;
  expires_at: Date | null;
  redacted_at: Date | null;
  created_at: Date;
}

function rowToCallTranscript(row: CallTranscriptRow): CallTranscript {
  return {
    id: row.id,
    account_id: row.account_id,
    call_id: row.call_id,
    inline_text: row.inline_text ?? undefined,
    language: row.language,
    retention_lane: row.retention_lane as TranscriptRetentionLane,
    expires_at: row.expires_at?.toISOString(),
    redacted_at: row.redacted_at?.toISOString(),
    created_at: row.created_at.toISOString(),
  };
}

/**
 * Public-shape projection. `raw_ref` and `redacted_ref` are deliberately
 * omitted — they are object-storage pointers to PII-bearing artifacts
 * and reading them requires a break-glass audit category that lands in
 * 31D. See ADR-0019 step 2.3 and the planning artifact Q7.
 */
const PUBLIC_SELECT = {
  id: true,
  account_id: true,
  call_id: true,
  inline_text: true,
  language: true,
  retention_lane: true,
  expires_at: true,
  redacted_at: true,
  created_at: true,
} as const;

export async function getCallTranscriptByCall(params: {
  accountId: string;
  callId: string;
}): Promise<Result<CallTranscript | null>> {
  const scope = await withTenantScope(params.accountId);
  if (!scope.ok) return err(scope.error.code, scope.error.message);

  if (db === null) {
    const found = getMockCallTranscripts().find((t) => t.call_id === params.callId);
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
    const row = await db.callTranscript.findUnique({
      where: { call_id: params.callId },
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
    return ok(rowToCallTranscript(row));
  } catch (e) {
    return errFromThrown<CallTranscript | null>(e);
  }
}

/**
 * Append-only writer. One transcript per call (enforced by the unique
 * index on `call_id`); duplicate writes throw `P2002` from Prisma and
 * surface as a `conflict` envelope to the caller.
 *
 * The writer accepts `raw_ref` and `redacted_ref` (the normalizer in
 * v0.3 will populate them) but the read surface above does not return
 * them. Privileged raw-transcript read lands after 31D's break-glass
 * audit category ships.
 */
export async function recordCallTranscript(entry: {
  account_id: string;
  call_id: string;
  raw_ref?: string | null;
  redacted_ref?: string | null;
  inline_text?: string | null;
  language?: string;
  retention_lane?: TranscriptRetentionLane;
  expires_at?: Date | null;
  redacted_at?: Date | null;
}): Promise<Result<CallTranscript>> {
  if (db === null) {
    return err(
      "not_available",
      "recordCallTranscript requires a database connection.",
    );
  }

  try {
    const created = await db.callTranscript.create({
      data: {
        account_id: entry.account_id,
        call_id: entry.call_id,
        raw_ref: entry.raw_ref ?? null,
        redacted_ref: entry.redacted_ref ?? null,
        inline_text: entry.inline_text ?? null,
        language: entry.language ?? "en",
        retention_lane: entry.retention_lane ?? "full",
        expires_at: entry.expires_at ?? null,
        redacted_at: entry.redacted_at ?? null,
      },
      select: PUBLIC_SELECT,
    });
    return ok(rowToCallTranscript(created));
  } catch (e) {
    return errFromThrown<CallTranscript>(e);
  }
}
