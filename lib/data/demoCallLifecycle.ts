import "@/lib/serverOnlyGuard";
import { db } from "@/lib/db/client";
import {
  RESPONSEOS_DEMO_ACCOUNT_ID,
  RESPONSEOS_DEMO_CALL_ID,
} from "@/lib/demo/constants";
import type { Account } from "@/types/account";
import type { Appointment } from "@/types/appointment";
import type { Call } from "@/types/call";
import type { CallSegment } from "@/types/callSegment";
import type { CallTranscript } from "@/types/callTranscript";
import type { Contact } from "@/types/contact";
import type { LeadEvent } from "@/types/lead";
import type { LeadQualification } from "@/types/leadQualification";
import type { QuoteRequest } from "@/types/quote";
import type { RevenueMetrics } from "@/types/revenue";
import type { WorkflowRun } from "@/types/workflowRun";
import type { AuditLog } from "./auditLogs";
import { err, errFromThrown, ok, type Result } from "./result";
import { withTenantScope } from "./session-helpers";

export interface DemoCallLifecycle {
  account: Account;
  contact: Contact | null;
  call: Call;
  segments: CallSegment[];
  transcript: CallTranscript | null;
  lead: (LeadEvent & { qualification: LeadQualification | null }) | null;
  appointment: Appointment | null;
  quote: QuoteRequest | null;
  workflow: WorkflowRun | null;
  audit: AuditLog[];
  revenue: RevenueMetrics | null;
  outcome: {
    kind: "illustrative";
    verified: false;
    estimatedValueCents: number | null;
    recoveredValueCents: number | null;
  };
}

const iso = (value: Date): string => value.toISOString();
const optionalIso = (value: Date | null): string | undefined =>
  value ? value.toISOString() : undefined;

async function loadLifecycle(
  accountId: string,
  callId: string,
): Promise<Result<DemoCallLifecycle>> {
  if (db === null) {
    return err(
      "not_available",
      "Persisted demo data requires a database connection.",
    );
  }

  try {
    const [accountRow, callRow] = await Promise.all([
      db.account.findUnique({ where: { id: accountId } }),
      db.call.findFirst({ where: { id: callId, account_id: accountId } }),
    ]);
    if (!accountRow || !callRow) {
      return err("not_found", "Demo call lifecycle not found.");
    }

    const leadRow = await db.leadEvent.findFirst({
      where: { account_id: accountId, call_id: callId },
      orderBy: { created_at: "asc" },
    });
    const [contactRow, segmentRows, transcriptRow, qualificationRow, appointmentRow, quoteRow, workflowRow, auditRows, revenueRow] =
      await Promise.all([
        callRow.contact_id
          ? db.contact.findFirst({
              where: { id: callRow.contact_id, account_id: accountId },
            })
          : Promise.resolve(null),
        db.callSegment.findMany({
          where: { account_id: accountId, call_id: callId },
          orderBy: { sequence: "asc" },
        }),
        db.callTranscript.findFirst({
          where: { account_id: accountId, call_id: callId },
          select: {
            id: true,
            account_id: true,
            call_id: true,
            inline_text: true,
            language: true,
            retention_lane: true,
            expires_at: true,
            redacted_at: true,
            created_at: true,
          },
        }),
        leadRow
          ? db.leadQualification.findUnique({
              where: { lead_event_id: leadRow.id },
            })
          : Promise.resolve(null),
        leadRow
          ? db.appointment.findFirst({
              where: { account_id: accountId, lead_event_id: leadRow.id },
            })
          : Promise.resolve(null),
        leadRow
          ? db.quoteRequest.findFirst({
              where: { account_id: accountId, lead_event_id: leadRow.id },
            })
          : Promise.resolve(null),
        leadRow
          ? db.workflowRun.findFirst({
              where: { account_id: accountId, trigger_event_id: leadRow.id },
            })
          : Promise.resolve(null),
        db.auditLog.findMany({
          where: {
            account_id: accountId,
            OR: [
              { target_id: callId },
              ...(leadRow ? [{ target_id: leadRow.id }] : []),
            ],
          },
          orderBy: { created_at: "asc" },
        }),
        db.revenueMetrics.findFirst({
          where: { account_id: accountId },
          orderBy: { period_start: "desc" },
        }),
      ]);

    const qualification: LeadQualification | null = qualificationRow
      ? {
          id: qualificationRow.id,
          lead_event_id: qualificationRow.lead_event_id,
          service_needed: qualificationRow.service_needed ?? undefined,
          service_area_match: qualificationRow.service_area_match,
          budget_range: qualificationRow.budget_range ?? undefined,
          timeline: qualificationRow.timeline ?? undefined,
          property_type: qualificationRow.property_type ?? undefined,
          decision_maker: qualificationRow.decision_maker ?? undefined,
          qualification_score: qualificationRow.qualification_score,
          qualification_status: qualificationRow.qualification_status,
          disqualification_reason:
            qualificationRow.disqualification_reason ?? undefined,
          created_at: iso(qualificationRow.created_at),
        }
      : null;

    const lead: DemoCallLifecycle["lead"] = leadRow
      ? {
          id: leadRow.id,
          account_id: leadRow.account_id,
          contact_id: leadRow.contact_id ?? undefined,
          call_id: leadRow.call_id ?? undefined,
          source: leadRow.source,
          event_type: leadRow.event_type,
          status: leadRow.status,
          urgency: leadRow.urgency,
          estimated_value: leadRow.estimated_value ?? undefined,
          recovered_value: leadRow.recovered_value ?? undefined,
          notes: leadRow.notes ?? undefined,
          created_at: iso(leadRow.created_at),
          updated_at: iso(leadRow.updated_at),
          qualification,
        }
      : null;

    return ok({
      account: {
        id: accountRow.id,
        name: accountRow.name,
        slug: accountRow.slug,
        industry: accountRow.industry,
        website_url: accountRow.website_url ?? undefined,
        primary_phone: accountRow.primary_phone ?? undefined,
        timezone: accountRow.timezone,
        status: accountRow.status,
        account_type: accountRow.account_type,
        clerk_org_id: accountRow.clerk_org_id ?? undefined,
        created_at: iso(accountRow.created_at),
        updated_at: iso(accountRow.updated_at),
      },
      contact: contactRow
        ? {
            id: contactRow.id,
            account_id: contactRow.account_id,
            first_name: contactRow.first_name ?? undefined,
            last_name: contactRow.last_name ?? undefined,
            phone: contactRow.phone ?? undefined,
            email: contactRow.email ?? undefined,
            address: contactRow.address ?? undefined,
            city: contactRow.city ?? undefined,
            state: contactRow.state ?? undefined,
            zip: contactRow.zip ?? undefined,
            source: contactRow.source,
            created_at: iso(contactRow.created_at),
            updated_at: iso(contactRow.updated_at),
          }
        : null,
      call: {
        id: callRow.id,
        account_id: callRow.account_id,
        contact_id: callRow.contact_id ?? undefined,
        provider: callRow.provider,
        provider_call_id: callRow.provider_call_id ?? undefined,
        direction: callRow.direction,
        status: callRow.status,
        from_number: callRow.from_number,
        to_number: callRow.to_number,
        started_at: iso(callRow.started_at),
        ended_at: optionalIso(callRow.ended_at),
        duration_seconds: callRow.duration_seconds ?? undefined,
        recording_url: callRow.recording_url ?? undefined,
        transcript: callRow.transcript ?? undefined,
        summary: callRow.summary ?? undefined,
        sentiment: callRow.sentiment ?? undefined,
        spam_score: callRow.spam_score ?? undefined,
        lead_score: callRow.lead_score ?? undefined,
        created_at: iso(callRow.created_at),
      },
      segments: segmentRows.map((row) => ({
        id: row.id,
        account_id: row.account_id,
        call_id: row.call_id,
        sequence: row.sequence,
        speaker: row.speaker,
        text: row.text,
        redacted_text: row.redacted_text ?? undefined,
        confidence: row.confidence ?? undefined,
        started_at: iso(row.started_at),
        ended_at: iso(row.ended_at),
        created_at: iso(row.created_at),
      })),
      transcript: transcriptRow
        ? {
            id: transcriptRow.id,
            account_id: transcriptRow.account_id,
            call_id: transcriptRow.call_id,
            inline_text: transcriptRow.inline_text ?? undefined,
            language: transcriptRow.language,
            retention_lane: transcriptRow.retention_lane,
            expires_at: optionalIso(transcriptRow.expires_at),
            redacted_at: optionalIso(transcriptRow.redacted_at),
            created_at: iso(transcriptRow.created_at),
          }
        : null,
      lead,
      appointment: appointmentRow
        ? {
            id: appointmentRow.id,
            account_id: appointmentRow.account_id,
            contact_id: appointmentRow.contact_id,
            lead_event_id: appointmentRow.lead_event_id ?? undefined,
            calendar_provider: appointmentRow.calendar_provider,
            external_event_id: appointmentRow.external_event_id ?? undefined,
            title: appointmentRow.title,
            start_time: iso(appointmentRow.start_time),
            end_time: iso(appointmentRow.end_time),
            status: appointmentRow.status,
            location: appointmentRow.location ?? undefined,
            notes: appointmentRow.notes ?? undefined,
            created_at: iso(appointmentRow.created_at),
            updated_at: iso(appointmentRow.updated_at),
          }
        : null,
      quote: quoteRow
        ? {
            id: quoteRow.id,
            account_id: quoteRow.account_id,
            contact_id: quoteRow.contact_id,
            lead_event_id: quoteRow.lead_event_id ?? undefined,
            service_type: quoteRow.service_type,
            description: quoteRow.description ?? undefined,
            photos: quoteRow.photos,
            property_address: quoteRow.property_address ?? undefined,
            estimated_value: quoteRow.estimated_value ?? undefined,
            status: quoteRow.status,
            created_at: iso(quoteRow.created_at),
            updated_at: iso(quoteRow.updated_at),
          }
        : null,
      workflow: workflowRow
        ? {
            id: workflowRow.id,
            account_id: workflowRow.account_id,
            workflow_run_id: workflowRow.workflow_run_id,
            workflow_id: workflowRow.workflow_id,
            provider: workflowRow.provider,
            trigger_event_id: workflowRow.trigger_event_id ?? undefined,
            status: workflowRow.status,
            started_at: iso(workflowRow.started_at),
            ended_at: optionalIso(workflowRow.ended_at),
            error_message: workflowRow.error_message ?? undefined,
            payload_json: workflowRow.payload_json ?? undefined,
            created_at: iso(workflowRow.created_at),
          }
        : null,
      audit: auditRows.map((row) => ({
        id: row.id,
        account_id: row.account_id ?? undefined,
        actor_user_id: row.actor_user_id ?? undefined,
        actor_type: row.actor_type,
        actor_role: row.actor_role ?? undefined,
        action: row.action,
        category: row.category ?? undefined,
        target_type: row.target_type ?? undefined,
        target_id: row.target_id ?? undefined,
        reason: row.reason ?? undefined,
        before_ref: row.before_ref ?? undefined,
        after_ref: row.after_ref ?? undefined,
        expires_at: optionalIso(row.expires_at),
        metadata_json: row.metadata_json ?? undefined,
        ip_address: row.ip_address ?? undefined,
        user_agent: row.user_agent ?? undefined,
        created_at: iso(row.created_at),
      })),
      revenue: revenueRow
        ? {
            id: revenueRow.id,
            account_id: revenueRow.account_id,
            period_start: iso(revenueRow.period_start),
            period_end: iso(revenueRow.period_end),
            total_calls: revenueRow.total_calls,
            missed_calls: revenueRow.missed_calls,
            calls_answered_by_ai: revenueRow.calls_answered_by_ai,
            qualified_leads: revenueRow.qualified_leads,
            appointments_booked: revenueRow.appointments_booked,
            quotes_requested: revenueRow.quotes_requested,
            quotes_sent: revenueRow.quotes_sent,
            jobs_won: revenueRow.jobs_won,
            estimated_recovered_revenue:
              revenueRow.estimated_recovered_revenue,
            verified_recovered_revenue:
              revenueRow.verified_recovered_revenue,
            admin_hours_saved: revenueRow.admin_hours_saved,
            response_time_avg_seconds: revenueRow.response_time_avg_seconds,
            roi_multiple: revenueRow.roi_multiple ?? undefined,
            created_at: iso(revenueRow.created_at),
          }
        : null,
      outcome: {
        kind: "illustrative",
        verified: false,
        estimatedValueCents: leadRow?.estimated_value ?? null,
        recoveredValueCents: leadRow?.recovered_value ?? null,
      },
    });
  } catch (error) {
    return errFromThrown<DemoCallLifecycle>(error);
  }
}

export async function getDemoCallLifecycle(params: {
  accountId: string;
  callId: string;
}): Promise<Result<DemoCallLifecycle>> {
  const scope = await withTenantScope(params.accountId);
  if (!scope.ok) return err(scope.error.code, scope.error.message);
  if (scope.effectiveAccountId !== params.accountId) {
    return err(
      "tenant_scope_denied",
      "Caller is not in the resource's tenant scope.",
    );
  }
  return loadLifecycle(scope.effectiveAccountId, params.callId);
}

export async function getPublicDemoCallLifecycle(): Promise<
  Result<DemoCallLifecycle>
> {
  return loadLifecycle(RESPONSEOS_DEMO_ACCOUNT_ID, RESPONSEOS_DEMO_CALL_ID);
}
