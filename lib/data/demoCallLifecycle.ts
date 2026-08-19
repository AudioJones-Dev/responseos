import "@/lib/serverOnlyGuard";
import { db } from "@/lib/db/client";
import {
  RESPONSEOS_DEMO_ACCOUNT_ID,
  RESPONSEOS_DEMO_CALL_ID,
} from "@/lib/demo/constants";
import { err, errFromThrown, ok, type Result } from "./result";

export interface DemoCallLifecycle {
  account: {
    id: string;
    name: string;
    account_type: string;
  };
  contact: {
    first_name?: string;
    last_name?: string;
    city?: string;
    state?: string;
  } | null;
  call: {
    id: string;
    started_at: string;
    created_at: string;
    duration_seconds?: number;
    summary?: string;
  };
  segments: Array<{
    speaker: "caller" | "agent" | "system";
    text: string;
    redacted_text?: string;
    started_at: string;
  }>;
  transcript: { id: string; created_at: string } | null;
  lead: {
    id: string;
    event_type: string;
    status: string;
    urgency: "low" | "medium" | "high";
    estimated_value?: number;
    recovered_value?: number;
    qualification: {
      service_needed?: string;
      qualification_score: number;
      qualification_status: string;
    } | null;
  } | null;
  workflow: { id: string } | null;
  audit: Array<{ action: string; reason?: string }>;
  revenue: {
    estimated_recovered_revenue: number;
    verified_recovered_revenue: number;
    qualified_leads: number;
    appointments_booked: number;
  } | null;
  outcome: {
    kind: "illustrative";
    verified: false;
    estimatedValueCents: number | null;
    recoveredValueCents: number | null;
  };
}

export async function getPublicDemoCallLifecycle(): Promise<Result<DemoCallLifecycle>> {
  if (db === null) {
    return err("not_available", "Persisted demo data requires a database connection.");
  }
  try {
    const account = await db.account.findUnique({ where: { id: RESPONSEOS_DEMO_ACCOUNT_ID } });
    const call = await db.call.findFirst({
      where: { id: RESPONSEOS_DEMO_CALL_ID, account_id: RESPONSEOS_DEMO_ACCOUNT_ID },
    });
    if (!account || !call) return err("not_found", "Persisted demo lifecycle not found.");

    const lead = await db.leadEvent.findFirst({
      where: { account_id: account.id, call_id: call.id },
      orderBy: { created_at: "asc" },
    });
    const [contact, segments, transcript, qualification, workflow, audit, revenue] = await Promise.all([
      call.contact_id
        ? db.contact.findFirst({ where: { id: call.contact_id, account_id: account.id } })
        : Promise.resolve(null),
      db.callSegment.findMany({
        where: { account_id: account.id, call_id: call.id },
        orderBy: { sequence: "asc" },
      }),
      db.callTranscript.findFirst({
        where: { account_id: account.id, call_id: call.id },
        select: { id: true, created_at: true },
      }),
      lead
        ? db.leadQualification.findUnique({ where: { lead_event_id: lead.id } })
        : Promise.resolve(null),
      lead
        ? db.workflowRun.findFirst({
            where: { account_id: account.id, trigger_event_id: lead.id },
            select: { id: true },
          })
        : Promise.resolve(null),
      db.auditLog.findMany({
        where: { account_id: account.id, target_id: call.id },
        orderBy: { created_at: "asc" },
        select: { action: true, reason: true },
      }),
      db.revenueMetrics.findFirst({
        where: { account_id: account.id },
        orderBy: { period_start: "desc" },
      }),
    ]);

    return ok({
      account: { id: account.id, name: account.name, account_type: account.account_type },
      contact: contact
        ? {
            first_name: contact.first_name ?? undefined,
            last_name: contact.last_name ?? undefined,
            city: contact.city ?? undefined,
            state: contact.state ?? undefined,
          }
        : null,
      call: {
        id: call.id,
        started_at: call.started_at.toISOString(),
        created_at: call.created_at.toISOString(),
        duration_seconds: call.duration_seconds ?? undefined,
        summary: call.summary ?? undefined,
      },
      segments: segments.map((segment) => ({
        speaker: segment.speaker,
        text: segment.text,
        redacted_text: segment.redacted_text ?? undefined,
        started_at: segment.started_at.toISOString(),
      })),
      transcript: transcript
        ? { id: transcript.id, created_at: transcript.created_at.toISOString() }
        : null,
      lead: lead
        ? {
            id: lead.id,
            event_type: lead.event_type,
            status: lead.status,
            urgency: lead.urgency,
            estimated_value: lead.estimated_value ?? undefined,
            recovered_value: lead.recovered_value ?? undefined,
            qualification: qualification
              ? {
                  service_needed: qualification.service_needed ?? undefined,
                  qualification_score: qualification.qualification_score,
                  qualification_status: qualification.qualification_status,
                }
              : null,
          }
        : null,
      workflow,
      audit: audit.map((entry) => ({
        action: entry.action,
        reason: entry.reason ?? undefined,
      })),
      revenue: revenue
        ? {
            estimated_recovered_revenue: revenue.estimated_recovered_revenue,
            verified_recovered_revenue: revenue.verified_recovered_revenue,
            qualified_leads: revenue.qualified_leads,
            appointments_booked: revenue.appointments_booked,
          }
        : null,
      outcome: {
        kind: "illustrative",
        verified: false,
        estimatedValueCents: lead?.estimated_value ?? null,
        recoveredValueCents: lead?.recovered_value ?? null,
      },
    });
  } catch (error) {
    return errFromThrown(error);
  }
}
