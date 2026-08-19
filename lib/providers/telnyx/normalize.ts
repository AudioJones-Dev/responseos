import "@/lib/serverOnlyGuard";
import { db } from "@/lib/db/client";
import { setWebhookProcessStatus } from "@/lib/data/webhookEvents";
import {
  getTelnyxCallId,
  type TelnyxWebhookEnvelope,
} from "@/lib/providers/telnyx/webhook";

function stringValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    for (const key of ["phone_number", "number", "uri"]) {
      if (typeof record[key] === "string" && record[key].trim()) return record[key].trim();
    }
  }
  return null;
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function dateValue(value: unknown, fallback: Date): Date {
  if (typeof value !== "string") return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function transcriptText(payload: Record<string, unknown>): string | null {
  if (typeof payload.transcript === "string") return payload.transcript;
  if (!Array.isArray(payload.transcript)) return null;
  const lines = payload.transcript.flatMap((entry) => {
    const item = recordValue(entry);
    if (!item) return [];
    const text = stringValue(item.content) ?? stringValue(item.text);
    if (!text) return [];
    const speaker = stringValue(item.role) ?? stringValue(item.speaker) ?? "speaker";
    return [`${speaker}: ${text}`];
  });
  return lines.length ? lines.join("\n") : null;
}

function insightsFrom(payload: Record<string, unknown>) {
  const result = recordValue(payload.result);
  const insights = recordValue(payload.insights) ?? recordValue(result?.insights) ?? result;
  const qualification = recordValue(payload.qualification) ?? recordValue(insights?.qualification);
  const summary =
    stringValue(payload.summary) ??
    stringValue(insights?.summary) ??
    stringValue(result?.summary);
  const nextAction =
    stringValue(payload.next_action) ??
    stringValue(insights?.next_action) ??
    stringValue(qualification?.next_action);
  return { insights, qualification, summary, nextAction };
}

function qualificationStatus(value: unknown): "qualified" | "maybe" | "unqualified" | "spam" {
  if (value === true || value === "qualified") return "qualified";
  if (value === "spam") return "spam";
  if (value === false || value === "unqualified" || value === "rejected") return "unqualified";
  return "maybe";
}

function boundedScore(value: unknown, status: string): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (Number.isFinite(numeric)) return Math.max(0, Math.min(100, Math.round(numeric)));
  return status === "qualified" ? 80 : status === "unqualified" ? 20 : 50;
}

function timeline(value: unknown): "same_day" | "this_week" | "this_month" | "unknown" {
  return value === "same_day" || value === "this_week" || value === "this_month"
    ? value
    : "unknown";
}

export async function normalizeTelnyxEvent(params: {
  accountId: string;
  demoNumber: string;
  webhookEventId: string;
  event: TelnyxWebhookEnvelope;
}): Promise<{ callId: string | null; finalized: boolean }> {
  if (db === null) throw new Error("database_unavailable");
  const payload = params.event.data.payload;
  const providerCallId = getTelnyxCallId(payload);
  if (!providerCallId) {
    await setWebhookProcessStatus({
      id: params.webhookEventId,
      process_status: "rejected",
      process_error: "missing_provider_call_id",
    });
    return { callId: null, finalized: false };
  }

  const existing = await db.call.findUnique({
    where: {
      account_id_provider_provider_call_id: {
        account_id: params.accountId,
        provider: "telnyx",
        provider_call_id: providerCallId,
      },
    },
  });
  const fromNumber = stringValue(payload.from) ?? existing?.from_number ?? "unavailable";
  const toNumber = stringValue(payload.to) ?? existing?.to_number ?? params.demoNumber;
  if (toNumber !== "unavailable" && toNumber.replace(/\D/g, "") !== params.demoNumber.replace(/\D/g, "")) {
    await setWebhookProcessStatus({
      id: params.webhookEventId,
      process_status: "rejected",
      process_error: "unexpected_destination",
    });
    return { callId: null, finalized: false };
  }

  const insight = insightsFrom(payload);
  let contactId = existing?.contact_id ?? null;
  if (!contactId && fromNumber !== "unavailable") {
    const contact =
      (await db.contact.findFirst({
        where: { account_id: params.accountId, phone: fromNumber },
      })) ??
      (await db.contact.create({
        data: { account_id: params.accountId, phone: fromNumber, source: "call" },
      }));
    contactId = contact.id;
  }
  const verifiedEmail = stringValue(insight.qualification?.email);
  if (contactId && verifiedEmail && insight.qualification?.email_verified === true) {
    await db.contact.update({
      where: { id: contactId },
      data: { email: verifiedEmail, email_verified: true },
    });
  }

  const eventType = params.event.data.event_type;
  const completed =
    eventType === "call.hangup" ||
    eventType === "call.conversation.ended" ||
    eventType === "call.conversation_insights.generated";
  const finalized = eventType === "call.conversation_insights.generated";
  const occurredAt = dateValue(params.event.data.occurred_at, new Date());
  const startedAt = dateValue(payload.start_time, existing?.started_at ?? occurredAt);
  const endedAt = completed ? dateValue(payload.end_time, occurredAt) : existing?.ended_at;
  const transcript = transcriptText(payload);
  const duration =
    typeof payload.duration_secs === "number"
      ? Math.max(0, Math.round(payload.duration_secs))
      : existing?.duration_seconds;

  const call = await db.call.upsert({
    where: {
      account_id_provider_provider_call_id: {
        account_id: params.accountId,
        provider: "telnyx",
        provider_call_id: providerCallId,
      },
    },
    create: {
      account_id: params.accountId,
      contact_id: contactId,
      provider: "telnyx",
      provider_call_id: providerCallId,
      direction: "inbound",
      status: completed ? "completed" : "answered",
      from_number: fromNumber,
      to_number: toNumber,
      started_at: startedAt,
      ended_at: endedAt,
      duration_seconds: duration,
      transcript,
      summary: insight.summary,
    },
    update: {
      contact_id: contactId,
      status: completed ? "completed" : existing?.status ?? "answered",
      from_number: fromNumber,
      to_number: toNumber,
      started_at: existing && existing.started_at < startedAt ? existing.started_at : startedAt,
      ended_at: endedAt,
      duration_seconds: duration,
      transcript: transcript ?? existing?.transcript,
      summary: insight.summary ?? existing?.summary,
    },
  });

  if (transcript) {
    await db.callTranscript.upsert({
      where: { call_id: call.id },
      create: {
        account_id: params.accountId,
        call_id: call.id,
        inline_text: transcript,
        retention_lane: "full",
      },
      update: { inline_text: transcript },
    });
  }

  if (insight.qualification || insight.summary) {
    const rawStatus = insight.qualification?.status ?? insight.qualification?.qualified;
    const status = qualificationStatus(rawStatus);
    const lead =
      (await db.leadEvent.findFirst({
        where: { account_id: params.accountId, call_id: call.id },
      })) ??
      (await db.leadEvent.create({
        data: {
          account_id: params.accountId,
          contact_id: contactId,
          call_id: call.id,
          source: "phone",
          event_type: status === "qualified" ? "qualified_lead" : "follow_up_needed",
          status: status === "qualified" ? "qualified" : "new",
          notes: insight.nextAction,
        },
      }));
    await db.leadEvent.update({
      where: { id: lead.id },
      data: {
        event_type: status === "qualified" ? "qualified_lead" : "follow_up_needed",
        status: status === "qualified" ? "qualified" : "unqualified",
        notes: insight.nextAction ?? lead.notes,
      },
    });
    await db.leadQualification.upsert({
      where: { lead_event_id: lead.id },
      create: {
        lead_event_id: lead.id,
        service_needed: stringValue(insight.qualification?.service_needed),
        service_area_match: insight.qualification?.service_area_match === true,
        budget_range: stringValue(insight.qualification?.budget_range),
        timeline: timeline(insight.qualification?.timeline),
        property_type: stringValue(insight.qualification?.property_type),
        decision_maker:
          typeof insight.qualification?.decision_maker === "boolean"
            ? insight.qualification.decision_maker
            : null,
        qualification_score: boundedScore(insight.qualification?.score, status),
        qualification_status: status,
        disqualification_reason: stringValue(insight.qualification?.disqualification_reason),
      },
      update: {
        service_needed: stringValue(insight.qualification?.service_needed),
        service_area_match: insight.qualification?.service_area_match === true,
        budget_range: stringValue(insight.qualification?.budget_range),
        timeline: timeline(insight.qualification?.timeline),
        property_type: stringValue(insight.qualification?.property_type),
        decision_maker:
          typeof insight.qualification?.decision_maker === "boolean"
            ? insight.qualification.decision_maker
            : null,
        qualification_score: boundedScore(insight.qualification?.score, status),
        qualification_status: status,
        disqualification_reason: stringValue(insight.qualification?.disqualification_reason),
      },
    });
  }

  await setWebhookProcessStatus({ id: params.webhookEventId, process_status: "processed" });
  return { callId: call.id, finalized };
}
