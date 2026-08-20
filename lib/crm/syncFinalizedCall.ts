import "@/lib/serverOnlyGuard";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { getCrmProvider } from "@/lib/providers/crm";
import type { CrmProvider } from "@/lib/providers/crm";
import { err, errFromThrown, ok, type Result } from "@/lib/data/result";
import { sanitizeCrmText } from "@/lib/crm/sanitization";

export type CrmSyncStatus =
  | "pending"
  | "processing"
  | "succeeded"
  | "retryable_failed"
  | "review_required"
  | "cancelled";

export interface CrmSyncOperationView {
  id: string;
  account_id: string;
  operation_key: string;
  provider: string;
  call_id: string;
  source_webhook_id?: string;
  status: CrmSyncStatus;
  attempt_count: number;
  provider_contact_id?: string;
  provider_activity_id?: string;
  provider_task_id?: string;
  last_error_code?: string;
  last_error_redacted?: string;
  next_attempt_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

type OperationRow = Awaited<ReturnType<NonNullable<typeof db>["crmSyncOperation"]["findUnique"]>>;

function toView(row: NonNullable<OperationRow>): CrmSyncOperationView {
  return {
    id: row.id,
    account_id: row.account_id,
    operation_key: row.operation_key,
    provider: row.provider,
    call_id: row.call_id,
    source_webhook_id: row.source_webhook_id ?? undefined,
    status: row.status,
    attempt_count: row.attempt_count,
    provider_contact_id: row.provider_contact_id ?? undefined,
    provider_activity_id: row.provider_activity_id ?? undefined,
    provider_task_id: row.provider_task_id ?? undefined,
    last_error_code: row.last_error_code ?? undefined,
    last_error_redacted: row.last_error_redacted ?? undefined,
    next_attempt_at: row.next_attempt_at?.toISOString(),
    completed_at: row.completed_at?.toISOString(),
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

function normalizeE164(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return null;
}

function redactedError(error: unknown): { code: string; message: string } {
  const raw = error instanceof Error ? error.message : "crm_sync_failed";
  const code = raw.startsWith("hubspot_http_") ? raw : "crm_sync_failed";
  return { code, message: code.slice(0, 120) };
}

export async function runCrmSyncForCall(params: {
  accountId: string;
  callId: string;
  sourceWebhookId?: string;
  providerOverride?: CrmProvider;
}): Promise<Result<CrmSyncOperationView>> {
  if (db === null) return err("no_database", "CRM synchronization requires a database connection.");

  const provider = params.providerOverride ?? getCrmProvider();
  const operationKey = `crm-call:${params.accountId}:${params.callId}`;

  try {
    let operation = await db.crmSyncOperation.upsert({
      where: { operation_key: operationKey },
      create: {
        account_id: params.accountId,
        operation_key: operationKey,
        provider: provider.providerId,
        call_id: params.callId,
        source_webhook_id: params.sourceWebhookId,
      },
      update: {},
    });
    if (operation.status === "succeeded" || operation.status === "review_required") {
      return ok(toView(operation));
    }
    if (operation.provider === "hubspot" && provider.providerId !== "hubspot") {
      operation = await db.crmSyncOperation.update({
        where: { id: operation.id },
        data: {
          status: "retryable_failed",
          last_error_code: "live_provider_disabled",
          last_error_redacted: "live_provider_disabled",
          next_attempt_at: null,
        },
      });
      return ok(toView(operation));
    }

    operation = await db.crmSyncOperation.update({
      where: { id: operation.id },
      data: {
        status: "processing",
        attempt_count: { increment: 1 },
        last_error_code: null,
        last_error_redacted: null,
        next_attempt_at: null,
      },
    });

    const call = await db.call.findFirst({
      where: { id: params.callId, account_id: params.accountId },
    });
    if (!call || call.status !== "completed") throw new Error("canonical_call_not_finalized");
    const contact = call.contact_id
      ? await db.contact.findFirst({
          where: { id: call.contact_id, account_id: params.accountId },
        })
      : null;
    const phone = normalizeE164(contact?.phone ?? call.from_number);
    if (!phone) throw new Error("caller_phone_unavailable");
    const lead = await db.leadEvent.findFirst({
      where: { account_id: params.accountId, call_id: call.id },
      orderBy: { created_at: "asc" },
    });
    const qualification = lead
      ? await db.leadQualification.findUnique({ where: { lead_event_id: lead.id } })
      : null;
    const qualificationLabel = qualification?.qualification_status ?? "not_scored";
    const sanitizedSummary = sanitizeCrmText(call.summary);
    const evidenceReference = `ResponseOS call ${call.id}`;

    let providerContactId = operation.provider_contact_id;
    if (!providerContactId) {
      const verifiedEmail = contact?.email_verified
        ? contact.email ?? undefined
        : undefined;
      const matches = await provider.findContacts({ phone, verifiedEmail });
      if (matches.length > 1) {
        operation = await db.crmSyncOperation.update({
          where: { id: operation.id },
          data: {
            status: "review_required",
            last_error_code: "ambiguous_contact_match",
            last_error_redacted: "ambiguous_contact_match",
          },
        });
        return ok(toView(operation));
      }
      providerContactId = matches[0]?.providerContactId;
      if (!providerContactId) {
        providerContactId = (
          await provider.createContact({
            phone,
            verifiedEmail,
            firstName: contact?.first_name ?? undefined,
            lastName: contact?.last_name ?? undefined,
          })
        ).providerContactId;
      }
      operation = await db.crmSyncOperation.update({
        where: { id: operation.id },
        data: { provider_contact_id: providerContactId },
      });
    }

    if (!operation.provider_activity_id) {
      const activity =
        (await provider.findCallActivity(evidenceReference)) ??
        (await provider.createCallActivity({
          contactId: providerContactId,
          occurredAt: call.started_at.toISOString(),
          durationSeconds: call.duration_seconds ?? undefined,
          sanitizedSummary,
          qualification: qualificationLabel,
          nextAction: lead?.notes ?? undefined,
          evidenceReference,
        }));
      operation = await db.crmSyncOperation.update({
        where: { id: operation.id },
        data: { provider_activity_id: activity.providerActivityId },
      });
    }
    await provider.associateContact(
      "calls",
      operation.provider_activity_id!,
      providerContactId,
    );

    if (
      qualification?.qualification_status === "qualified" &&
      !operation.provider_task_id
    ) {
      const task =
        (await provider.findFollowUpTask(evidenceReference)) ??
        (await provider.createFollowUpTask({
          contactId: providerContactId,
          dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          sanitizedSummary,
          nextAction: lead?.notes ?? "Review and contact the qualified caller.",
          evidenceReference,
        }));
      operation = await db.crmSyncOperation.update({
        where: { id: operation.id },
        data: { provider_task_id: task.providerTaskId },
      });
    }
    if (operation.provider_task_id) {
      await provider.associateContact(
        "tasks",
        operation.provider_task_id,
        providerContactId,
      );
    }

    operation = await db.crmSyncOperation.update({
      where: { id: operation.id },
      data: { status: "succeeded", completed_at: new Date() },
    });
    return ok(toView(operation));
  } catch (error) {
    const safe = redactedError(error);
    const updated = await db.crmSyncOperation.update({
      where: { operation_key: operationKey },
      data: {
        status: "retryable_failed",
        last_error_code: safe.code,
        last_error_redacted: safe.message,
        next_attempt_at: new Date(Date.now() + 5 * 60 * 1000),
      },
    }).catch(() => null);
    return updated ? ok(toView(updated)) : err(safe.code, safe.message);
  }
}

export async function listCrmSyncOperations(params: {
  accountId: string;
  status?: CrmSyncStatus;
}): Promise<Result<CrmSyncOperationView[]>> {
  try {
    await requireRole(["aj_admin", "operator"]);
  } catch (error) {
    return errFromThrown(error);
  }
  if (db === null) return ok([]);
  try {
    const rows = await db.crmSyncOperation.findMany({
      where: {
        account_id: params.accountId,
        ...(params.status ? { status: params.status } : {}),
      },
      orderBy: { updated_at: "desc" },
      take: 100,
    });
    return ok(rows.map(toView));
  } catch (error) {
    return errFromThrown(error);
  }
}

export async function retryCrmSyncOperation(params: {
  id: string;
  accountId: string;
}): Promise<Result<CrmSyncOperationView>> {
  const prepared = await prepareCrmSyncRetry(params);
  if (!prepared.ok) return prepared;
  return runCrmSyncForCall({
    accountId: params.accountId,
    callId: prepared.data.callId,
    sourceWebhookId: prepared.data.sourceWebhookId,
  });
}

export async function prepareCrmSyncRetry(params: {
  id: string;
  accountId: string;
}): Promise<Result<{ callId: string; sourceWebhookId?: string }>> {
  try {
    await requireRole(["aj_admin", "operator"]);
  } catch (error) {
    return errFromThrown(error);
  }
  if (db === null) return err("no_database", "CRM synchronization requires a database connection.");
  const operation = await db.crmSyncOperation.findFirst({
    where: { id: params.id, account_id: params.accountId },
  });
  if (!operation) return err("not_found", "CRM sync operation not found.");
  if (operation.status !== "retryable_failed") {
    return err("invalid_transition", "Only retryable CRM operations can be retried.");
  }
  return ok({
    callId: operation.call_id,
    sourceWebhookId: operation.source_webhook_id ?? undefined,
  });
}
