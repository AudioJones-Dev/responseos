import "@/lib/serverOnlyGuard";
import { db } from "@/lib/db/client";
import { err, errFromThrown, ok, type Result } from "@/lib/data/result";
import { retentionAuditData } from "./audit";
import { DEMO_CALL_RETENTION_DAYS, daysAfter } from "./periods";

const PURGED_NUMBER = "<PURGED>";

export type DemoCallPurgeCounts = { calls: number; webhookPayloads: number } & Record<string, number>;

/**
 * Purges caller content from general-demo calls older than 90 days. The call
 * row stays as a content-free stub (timing, status, the demo number) so the
 * purge is idempotent and late webhooks for the same call still dedupe.
 * Succeeded CRM operations are kept: they are the only local pointer to the
 * HubSpot copy, which this purge does not delete. Every other operation is
 * cancelled, including `processing`: a call this old has no live sync, so a
 * processing row is one a crashed worker left behind.
 */
export async function purgeExpiredDemoCallContent(params: {
  accountId: string;
  now?: Date;
  preview?: boolean;
}): Promise<Result<DemoCallPurgeCounts>> {
  if (db === null) return err("no_database", "Demo call purge requires DATABASE_URL.");
  const now = params.now ?? new Date();
  const accountId = params.accountId;
  const cutoff = daysAfter(now, -DEMO_CALL_RETENTION_DAYS);
  const callWhere = {
    account_id: accountId,
    provider: "telnyx" as const,
    started_at: { lte: cutoff },
    from_number: { not: PURGED_NUMBER },
  };
  const webhookWhere = {
    account_id: accountId,
    provider: "telnyx",
    payload_expires_at: null,
    payload_purged_at: null,
    received_at: { lte: cutoff },
  };
  try {
    if (params.preview) {
      const [calls, webhookPayloads] = await Promise.all([
        db.call.count({ where: callWhere }),
        db.webhookEvent.count({ where: webhookWhere }),
      ]);
      return ok({ calls, webhookPayloads });
    }
    const counts = await db.$transaction(async (tx) => {
      const calls = await tx.call.findMany({ where: callWhere, select: { id: true, contact_id: true } });
      const callIds = calls.map(({ id }) => id);
      const leads = await tx.leadEvent.findMany({
        where: { account_id: accountId, call_id: { in: callIds } },
        select: { id: true, contact_id: true },
      });
      const leadIds = leads.map(({ id }) => id);
      const contactIds = [...new Set([...calls, ...leads].flatMap(({ contact_id }) => (contact_id ? [contact_id] : [])))];

      const qualifications = await tx.leadQualification.deleteMany({ where: { lead_event_id: { in: leadIds } } });
      const leadResult = await tx.leadEvent.deleteMany({ where: { account_id: accountId, id: { in: leadIds } } });
      const segments = await tx.callSegment.deleteMany({ where: { account_id: accountId, call_id: { in: callIds } } });
      const qaLogs = await tx.qaLog.deleteMany({ where: { account_id: accountId, call_id: { in: callIds } } });
      const transcripts = await tx.callTranscript.updateMany({
        where: { account_id: accountId, call_id: { in: callIds } },
        data: { inline_text: null, raw_ref: null, redacted_ref: null, retention_lane: "metadata_only", redacted_at: now },
      });
      await tx.call.updateMany({
        where: { account_id: accountId, id: { in: callIds } },
        data: { contact_id: null, from_number: PURGED_NUMBER, transcript: null, summary: null, recording_url: null },
      });
      const crmOperations = await tx.crmSyncOperation.updateMany({
        where: { account_id: accountId, call_id: { in: callIds }, status: { in: ["pending", "processing", "retryable_failed", "review_required"] } },
        data: { status: "cancelled", last_error_code: "retention_purged", last_error_redacted: "retention_purged", next_attempt_at: null },
      });

      const contactRef = { account_id: accountId, contact_id: { in: contactIds } };
      const stillReferenced = new Set(
        [
          ...(await tx.call.findMany({ where: contactRef, select: { contact_id: true } })),
          ...(await tx.leadEvent.findMany({ where: contactRef, select: { contact_id: true } })),
          ...(await tx.appointment.findMany({ where: contactRef, select: { contact_id: true } })),
          ...(await tx.conversation.findMany({ where: contactRef, select: { contact_id: true } })),
          ...(await tx.quoteRequest.findMany({ where: contactRef, select: { contact_id: true } })),
          ...(await tx.professionalOpportunity.findMany({ where: contactRef, select: { contact_id: true } })),
        ].map(({ contact_id }) => contact_id),
      );
      const contacts = await tx.contact.deleteMany({
        where: { account_id: accountId, id: { in: contactIds.filter((id) => !stillReferenced.has(id)) } },
      });

      const webhooks = await tx.webhookEvent.updateMany({
        where: webhookWhere,
        data: { raw_body: "<PURGED_WEBHOOK_PAYLOAD>", signature_header: null, process_error: null, payload_purged_at: now },
      });

      const result: DemoCallPurgeCounts = {
        calls: calls.length,
        webhookPayloads: webhooks.count,
        segmentsDeleted: segments.count,
        transcriptsRedacted: transcripts.count,
        leadsDeleted: leadResult.count,
        qualificationsDeleted: qualifications.count,
        qaLogsDeleted: qaLogs.count,
        contactsDeleted: contacts.count,
        crmOperationsCancelled: crmOperations.count,
      };
      if (result.calls > 0 || result.webhookPayloads > 0) {
        await tx.auditLog.create({ data: retentionAuditData({
          accountId,
          action: "retention.demo_call_content_purged",
          targetType: "Call",
          reason: `General demo call content reached its ${DEMO_CALL_RETENTION_DAYS}-day retention boundary.`,
          metadata: { ...result, cutoff: cutoff.toISOString(), crmCopyDeleted: false },
          now,
        }) });
      }
      return result;
    });
    return ok(counts);
  } catch (error) {
    return errFromThrown(error);
  }
}
