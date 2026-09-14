import "@/lib/serverOnlyGuard";
import { db as database } from "@/lib/db/client";
import type { Prisma } from "@prisma/client";
import { setWebhookProcessStatus } from "@/lib/data/webhookEvents";
import { normalizeE164 } from "@/lib/validation/common";
import {
  extractTelnyxCallInsight,
  extractTelnyxTranscript,
  type TelnyxCallInsight,
} from "@/lib/providers/telnyx/insights";
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

function dateValue(value: unknown, fallback: Date): Date {
  if (typeof value !== "string") return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function sameNumber(left: string, right: string): boolean {
  const leftE164 = normalizeE164(left);
  const rightE164 = normalizeE164(right);
  if (leftE164 && rightE164) return leftE164 === rightE164;
  return left.replace(/\D/g, "") === right.replace(/\D/g, "");
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

function durationSeconds(payload: Record<string, unknown>): number | undefined {
  for (const key of ["duration_sec", "duration_secs", "duration_seconds"]) {
    const value = payload[key];
    if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.round(value));
  }
  return undefined;
}

/** Fill-when-empty unless the agent confirmed the caller's identity on this call. */
function nameUpdate(
  existing: string | null,
  next: string | null,
  identityConfirmed: boolean,
): string | undefined {
  if (!next) return undefined;
  if (existing && !identityConfirmed) return undefined;
  return next;
}

function locationLine(insight: TelnyxCallInsight): string | null {
  const parts = [insight.city, insight.state, insight.postalCode].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

export interface NormalizeTelnyxEventOptions {
  /** Write caller identity, location, and call classification from the insight. */
  captureCallerIdentity?: boolean;
  /** Create one QuoteRequest per lead event when the caller explicitly asked for a quote. */
  createQuoteRequest?: boolean;
  reviewRequired?: boolean;
}

export async function normalizeTelnyxEvent(params: {
  providerCallId?: string;
  client?: Prisma.TransactionClient;
  accountId: string;
  demoNumber: string;
  webhookEventId: string;
  event: TelnyxWebhookEnvelope;
  transcriptExpiresAt?: Date;
  options?: NormalizeTelnyxEventOptions;
}): Promise<{ callId: string | null; finalized: boolean }> {
  const db = params.client ?? database;
  if (db === null) throw new Error("database_unavailable");
  const payload = params.event.data.payload;
  const providerCallId = params.providerCallId ?? getTelnyxCallId(payload);
  if (!providerCallId) {
    await setWebhookProcessStatus({
      client: params.client,
      id: params.webhookEventId,
      process_status: "rejected",
      process_error: "missing_provider_call_id",
    });
    return { callId: null, finalized: false };
  }

  const captureIdentity = params.options?.captureCallerIdentity === true;

  const existing = await db.call.findUnique({
    where: {
      account_id_provider_provider_call_id: {
        account_id: params.accountId,
        provider: "telnyx",
        provider_call_id: providerCallId,
      },
    },
  });
  const rawFrom = stringValue(payload.from) ?? existing?.from_number ?? "unavailable";
  const fromNumber = rawFrom === "unavailable" ? rawFrom : normalizeE164(rawFrom) ?? rawFrom;
  const toNumber = stringValue(payload.to) ?? existing?.to_number ?? params.demoNumber;
  if (toNumber !== "unavailable" && !sameNumber(toNumber, params.demoNumber)) {
    await setWebhookProcessStatus({
      client: params.client,
      id: params.webhookEventId,
      process_status: "rejected",
      process_error: "unexpected_destination",
    });
    return { callId: null, finalized: false };
  }

  const insight = extractTelnyxCallInsight(payload);
  let contactId = existing?.contact_id ?? null;
  if (!contactId && fromNumber !== "unavailable") {
    // Match either spelling: contacts created before the shared E.164 helper
    // landed may still hold the provider's raw string.
    const contact =
      (await db.contact.findFirst({
        where: {
          account_id: params.accountId,
          OR: [{ phone: fromNumber }, { phone: rawFrom }],
        },
      })) ??
      (await db.contact.create({
        data: { account_id: params.accountId, phone: fromNumber, source: "call" },
      }));
    contactId = contact.id;
  }

  const verifiedEmail = stringValue(insight.qualification?.email);
  const contactUpdate: Record<string, unknown> = {};
  if (verifiedEmail && insight.qualification?.email_verified === true) {
    contactUpdate.email = verifiedEmail;
    contactUpdate.email_verified = true;
  }
  if (contactId && captureIdentity) {
    const contact = await db.contact.findUnique({ where: { id: contactId } });
    const firstName = nameUpdate(contact?.first_name ?? null, insight.firstName, insight.identityConfirmed);
    const lastName = nameUpdate(contact?.last_name ?? null, insight.lastName, insight.identityConfirmed);
    if (firstName) contactUpdate.first_name = firstName;
    if (lastName) contactUpdate.last_name = lastName;
    if (insight.city && !contact?.city) contactUpdate.city = insight.city;
    if (insight.state && !contact?.state) contactUpdate.state = insight.state;
    if (insight.postalCode && !contact?.zip) contactUpdate.zip = insight.postalCode;
  }
  if (contactId && Object.keys(contactUpdate).length > 0) {
    await db.contact.update({ where: { id: contactId }, data: contactUpdate });
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
  const transcript = extractTelnyxTranscript(payload);
  const duration = durationSeconds(payload) ?? existing?.duration_seconds ?? undefined;

  // Message-history updates are cumulative, so a later event with fewer turns
  // is a partial view and must not truncate what is already stored.
  const existingTurns = existing?.transcript ? existing.transcript.split("\n").length : 0;
  const transcriptText = transcript && transcript.turns >= existingTurns ? transcript.text : null;

  const classification = captureIdentity
    ? {
        ...(insight.callerRelationship && !existing?.caller_relationship
          ? { caller_relationship: insight.callerRelationship }
          : {}),
        ...(insight.interactionClass && !existing?.interaction_class
          ? { interaction_class: insight.interactionClass }
          : {}),
        ...(insight.recordingConsent && !existing?.recording_consent
          ? { recording_consent: insight.recordingConsent }
          : {}),
      }
    : {};

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
      transcript: transcriptText,
      summary: insight.summary,
      review_required: params.options?.reviewRequired === true,
      ...classification,
    },
    update: {
      contact_id: contactId,
      status: completed ? "completed" : existing?.status ?? "answered",
      from_number: fromNumber,
      to_number: toNumber,
      started_at: existing && existing.started_at < startedAt ? existing.started_at : startedAt,
      ended_at: endedAt,
      duration_seconds: duration,
      transcript: transcriptText ?? existing?.transcript,
      summary: insight.summary ?? existing?.summary,
      ...classification,
    },
  });

  if (transcriptText) {
    await db.callTranscript.upsert({
      where: { call_id: call.id },
      create: {
        account_id: params.accountId,
        call_id: call.id,
        inline_text: transcriptText,
        retention_lane: params.transcriptExpiresAt ? "redacted_only" : "full",
        expires_at: params.transcriptExpiresAt,
      },
      update: {
        inline_text: transcriptText,
        ...(params.transcriptExpiresAt
          ? { retention_lane: "redacted_only" as const, expires_at: params.transcriptExpiresAt }
          : {}),
      },
    });
  }

  if (insight.qualification || insight.summary || insight.quoteRequested) {
    const rawStatus = insight.qualification?.status ?? insight.qualification?.qualified;
    const status = qualificationStatus(rawStatus);
    const eventTypeForLead = insight.quoteRequested
      ? "quote_request"
      : status === "qualified"
        ? "qualified_lead"
        : "follow_up_needed";
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
          event_type: eventTypeForLead,
          status: status === "qualified" ? "qualified" : "new",
          notes: insight.nextAction,
        },
      }));
    await db.leadEvent.update({
      where: { id: lead.id },
      data: {
        event_type: eventTypeForLead,
        status: status === "qualified" ? "qualified" : "unqualified",
        notes: insight.nextAction ?? lead.notes,
      },
    });
    if (insight.qualification || insight.summary) {
      await db.leadQualification.upsert({
        where: { lead_event_id: lead.id },
        create: {
          lead_event_id: lead.id,
          service_needed: stringValue(insight.qualification?.service_needed) ?? insight.serviceRequested,
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
          service_needed: stringValue(insight.qualification?.service_needed) ?? insight.serviceRequested,
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

    // One quote request per lead event, and only when the caller explicitly
    // asked for one. A replayed event updates that row rather than adding another.
    if (params.options?.createQuoteRequest === true && insight.quoteRequested && contactId) {
      await db.quoteRequest.upsert({
        where: { lead_event_id: lead.id },
        create: {
          account_id: params.accountId,
          contact_id: contactId,
          lead_event_id: lead.id,
          service_type: insight.serviceRequested ?? "unspecified",
          description: insight.summary,
          photos: [],
          photos_requested: insight.photosRequested,
          property_address: locationLine(insight),
        },
        update: {
          service_type: insight.serviceRequested ?? "unspecified",
          description: insight.summary ?? undefined,
          photos_requested: insight.photosRequested,
          property_address: locationLine(insight) ?? undefined,
        },
      });
    }
  }

  await setWebhookProcessStatus({ client: params.client, id: params.webhookEventId, process_status: "processed" });
  return { callId: call.id, finalized };
}
