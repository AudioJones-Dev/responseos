/**
 * Reads the structured result of a Telnyx conversation-insight event.
 *
 * Documented shape (Telnyx AI assistants): `call.conversation_insights.generated`
 * carries `payload.results[]`, each `{ insight_id, result }` where `result` is a
 * STRING — JSON-encoded when the insight template declares a `json_schema`,
 * plain prose otherwise (the managed Summary insight). Nothing in the event
 * carries the transcript, and the insight event carries no `from`/`to`.
 *
 * Results are matched by parsing, not by insight id or array position, so the
 * provider-side insight can be renamed or reordered without a code change and
 * without storing provider ids in tenant configuration.
 *
 * The pre-ADR-0052 readers (`payload.summary`, `payload.qualification`,
 * `payload.insights`) are kept as a fallback for the legacy demo lane. That
 * shape is not documented by the provider and is confirmed by no captured
 * event; it is retained only because the legacy lane already depends on it.
 */

export type CallerRelationshipValue =
  | "new_prospect"
  | "returning_customer"
  | "contractor"
  | "vendor"
  | "other_or_unknown";

export type InteractionClassValue =
  | "new_sales"
  | "existing_customer_new_sale"
  | "new_service_request"
  | "existing_service_request"
  | "general_admin"
  | "contractor_vendor"
  | "human_escalation"
  | "unknown";

export type RecordingConsentValue = "continued" | "refused" | "unknown";

const CALLER_RELATIONSHIPS: readonly CallerRelationshipValue[] = [
  "new_prospect",
  "returning_customer",
  "contractor",
  "vendor",
  "other_or_unknown",
];

const INTERACTION_CLASSES: readonly InteractionClassValue[] = [
  "new_sales",
  "existing_customer_new_sale",
  "new_service_request",
  "existing_service_request",
  "general_admin",
  "contractor_vendor",
  "human_escalation",
  "unknown",
];

const RECORDING_CONSENTS: readonly RecordingConsentValue[] = ["continued", "refused", "unknown"];

export interface TelnyxCallInsight {
  summary: string | null;
  firstName: string | null;
  lastName: string | null;
  identityConfirmed: boolean;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  callerRelationship: CallerRelationshipValue | null;
  interactionClass: InteractionClassValue | null;
  recordingConsent: RecordingConsentValue | null;
  serviceRequested: string | null;
  quoteRequested: boolean;
  photosRequested: boolean;
  nextAction: string | null;
  qualification: Record<string, unknown> | null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (record(value)) {
    for (const key of ["phone_number", "number", "uri", "value", "text"]) {
      const nested = (value as Record<string, unknown>)[key];
      if (typeof nested === "string" && nested.trim()) return nested.trim();
    }
  }
  return null;
}

function bool(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return allowed.includes(normalized as T) ? (normalized as T) : null;
}

/** Reads a key from either a nested object or its flattened `prefix_key` form. */
function pick(source: Record<string, unknown>, nested: string | null, key: string): unknown {
  if (nested) {
    const child = record(source[nested]);
    if (child && key in child) return child[key];
  }
  if (key in source) return source[key];
  const flattened = nested ? `${nested}_${key}` : null;
  if (flattened && flattened in source) return source[flattened];
  return undefined;
}

function insightFrom(source: Record<string, unknown>): TelnyxCallInsight {
  const qualification = record(source.qualification) ?? record(record(source.insights)?.qualification);
  const fullName = text(pick(source, "caller", "full_name")) ?? text(pick(source, "caller", "name"));
  const spaceIndex = fullName ? fullName.indexOf(" ") : -1;
  return {
    summary:
      text(source.summary) ??
      text(record(source.insights)?.summary) ??
      text(record(source.result)?.summary),
    firstName:
      text(pick(source, "caller", "first_name")) ??
      (spaceIndex > 0 ? fullName!.slice(0, spaceIndex) : fullName),
    lastName:
      text(pick(source, "caller", "last_name")) ??
      (spaceIndex > 0 ? fullName!.slice(spaceIndex + 1) : null),
    identityConfirmed: bool(pick(source, "caller", "identity_confirmed")) === true,
    city: text(pick(source, "caller", "city")) ?? text(pick(source, "location", "city")),
    state: text(pick(source, "caller", "state")) ?? text(pick(source, "location", "state")),
    postalCode:
      text(pick(source, "caller", "postal_code")) ??
      text(pick(source, "location", "postal_code")) ??
      text(source.zip),
    callerRelationship: enumValue(
      pick(source, "caller", "relationship") ?? source.caller_relationship ?? source.relationship,
      CALLER_RELATIONSHIPS,
    ),
    interactionClass: enumValue(
      source.interaction_class ?? source.event_type ?? source.interaction_type,
      INTERACTION_CLASSES,
    ),
    recordingConsent: enumValue(source.recording_consent ?? source.consent, RECORDING_CONSENTS),
    serviceRequested:
      text(source.service_requested) ??
      text(source.service) ??
      text(qualification?.service_needed),
    quoteRequested: bool(source.quote_requested) === true,
    photosRequested: bool(source.photos_requested) === true,
    nextAction:
      text(source.next_action) ??
      text(record(source.insights)?.next_action) ??
      text(qualification?.next_action),
    qualification,
  };
}

function isEmpty(insight: TelnyxCallInsight): boolean {
  return (
    !insight.summary &&
    !insight.firstName &&
    !insight.lastName &&
    !insight.callerRelationship &&
    !insight.interactionClass &&
    !insight.recordingConsent &&
    !insight.serviceRequested &&
    !insight.nextAction &&
    !insight.city &&
    !insight.postalCode &&
    !insight.quoteRequested &&
    !insight.photosRequested &&
    !insight.qualification
  );
}

function merge(base: TelnyxCallInsight, next: TelnyxCallInsight): TelnyxCallInsight {
  return {
    summary: base.summary ?? next.summary,
    firstName: base.firstName ?? next.firstName,
    lastName: base.lastName ?? next.lastName,
    identityConfirmed: base.identityConfirmed || next.identityConfirmed,
    city: base.city ?? next.city,
    state: base.state ?? next.state,
    postalCode: base.postalCode ?? next.postalCode,
    callerRelationship: base.callerRelationship ?? next.callerRelationship,
    interactionClass: base.interactionClass ?? next.interactionClass,
    recordingConsent: base.recordingConsent ?? next.recordingConsent,
    serviceRequested: base.serviceRequested ?? next.serviceRequested,
    quoteRequested: base.quoteRequested || next.quoteRequested,
    photosRequested: base.photosRequested || next.photosRequested,
    nextAction: base.nextAction ?? next.nextAction,
    qualification: base.qualification ?? next.qualification,
  };
}

export function extractTelnyxCallInsight(payload: Record<string, unknown>): TelnyxCallInsight {
  let merged: TelnyxCallInsight | null = null;
  let proseSummary: string | null = null;

  const results = Array.isArray(payload.results) ? payload.results : [];
  for (const entry of results) {
    const item = record(entry);
    if (!item) continue;
    const raw = item.result;
    const source = record(raw) ?? (() => {
      if (typeof raw !== "string") return null;
      const trimmed = raw.trim();
      if (!trimmed.startsWith("{")) {
        // A managed insight (for example Summary) returns prose, not JSON.
        proseSummary = proseSummary ?? trimmed;
        return null;
      }
      try {
        return record(JSON.parse(trimmed));
      } catch {
        proseSummary = proseSummary ?? trimmed;
        return null;
      }
    })();
    if (!source) continue;
    const candidate = insightFrom(source);
    if (isEmpty(candidate)) continue;
    merged = merged ? merge(merged, candidate) : candidate;
  }

  const legacy = insightFrom(payload);
  const combined = merged ? merge(merged, legacy) : legacy;
  return { ...combined, summary: combined.summary ?? proseSummary };
}

export interface TelnyxTranscript {
  text: string;
  turns: number;
}

/**
 * Builds transcript text from a push event. Telnyx delivers conversation turns
 * through `call.ai_gather.message_history_updated` when
 * `send_message_history_updates` is enabled, as `{ role, content }` entries;
 * pulling them from the messages API instead would require an account-wide
 * Telnyx API key in the runtime, which the deployment lane forbids.
 */
export function extractTelnyxTranscript(payload: Record<string, unknown>): TelnyxTranscript | null {
  if (typeof payload.transcript === "string" && payload.transcript.trim()) {
    const value = payload.transcript.trim();
    return { text: value, turns: value.split("\n").length };
  }
  const entries = [payload.message_history, payload.transcript, payload.messages].find((value) =>
    Array.isArray(value),
  );
  if (!Array.isArray(entries)) return null;
  const lines = entries.flatMap((entry) => {
    const item = record(entry);
    if (!item) return [];
    const content = text(item.content) ?? text(item.text);
    if (!content) return [];
    const speaker = text(item.role) ?? text(item.speaker) ?? "speaker";
    return [`${speaker}: ${content}`];
  });
  return lines.length ? { text: lines.join("\n"), turns: lines.length } : null;
}
