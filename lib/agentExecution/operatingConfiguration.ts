import { z } from "zod";
import type { BusinessMemorySnapshot } from "@/lib/prospectBootstrap/contracts";
import { e164PhoneSchema } from "@/lib/validation/common";
import { isExecutionMode, type ExecutionMode } from "./policy";

/**
 * Operating configuration a tenant's memory snapshot must carry before a mode
 * may be activated (ADR-0051 decision 3), and the typed shape each value must
 * parse into (ADR-0052).
 *
 * Readiness reports configuration only. It never opens an activation gate;
 * those stay in `EXECUTION_MODE_ACTIVATION_GATES` and the roadmap.
 */
const SUPERVISED_OPERATING_CONFIGURATION: readonly string[] = Object.freeze([
  "operating_hours.weekly",
  "operating_hours.holidays",
  "service_area.coverage",
  "contact.escalation",
  "policy.consent",
]);

export const OPERATING_CONFIGURATION_REQUIREMENTS: Readonly<Record<ExecutionMode, readonly string[]>> = Object.freeze({
  PROSPECT_DEMO: Object.freeze([]),
  SUPERVISED_PILOT: SUPERVISED_OPERATING_CONFIGURATION,
  PRODUCTION_SUPERVISED: SUPERVISED_OPERATING_CONFIGURATION,
  MANAGED_AUTONOMY: SUPERVISED_OPERATING_CONFIGURATION,
});

/**
 * A value that looks like a fill-in-later marker is not configuration. Without
 * this an agent would read "TBD" aloud as though it were an approved fact.
 */
const PLACEHOLDER_VALUE = /^(?:tbd|tba|to be determined|todo|n\/?a|none|null|unknown|placeholder|example|xxx+|\.{2,}|-+|<.*>|\{\{.*\}\})$/i;

function configuredString(max: number) {
  return z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) => !PLACEHOLDER_VALUE.test(value), "placeholder_value_not_allowed");
}

const TIME_OF_DAY = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

const WeeklyDaySchema = z
  .strictObject({
    day: z.enum(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]),
    closed: z.boolean(),
    opensAt: z.string().regex(TIME_OF_DAY).optional(),
    closesAt: z.string().regex(TIME_OF_DAY).optional(),
  })
  .refine(
    (day) => (day.closed ? !day.opensAt && !day.closesAt : Boolean(day.opensAt && day.closesAt)),
    "an open day needs both opensAt and closesAt, a closed day needs neither",
  );

export const WeeklyOperatingHoursSchema = z.union([
  z.strictObject({ type: z.literal("always_open") }),
  z.strictObject({
    type: z.literal("schedule"),
    timezone: configuredString(64),
    days: z.array(WeeklyDaySchema).min(1).max(7).refine((days) => new Set(days.map((day) => day.day)).size === days.length, "duplicate_weekday"),
  }),
]);

export const HolidayOperatingHoursSchema = z.union([
  z.strictObject({ type: z.literal("always_open") }),
  z.strictObject({
    type: z.literal("closures"),
    timezone: configuredString(64),
    closures: z
      .array(z.strictObject({ date: z.iso.date(), name: configuredString(80), closed: z.boolean() }))
      .min(1)
      .max(60)
      .refine((closures) => new Set(closures.map((closure) => closure.date)).size === closures.length, "duplicate_holiday_date"),
  }),
]);

/**
 * Coverage is a named region list, never a county or municipality inferred from
 * one. `locationConfirmationRequired` keeps the agent asking for the caller's
 * city or postal code and marking it for human confirmation.
 */
export const ServiceAreaCoverageSchema = z.strictObject({
  regions: z.array(configuredString(80)).min(1).max(25),
  precision: z.literal("broad_region"),
  countyInferenceAllowed: z.literal(false),
  locationConfirmationRequired: z.literal(true),
  collectFromCaller: z.array(z.enum(["city", "postal_code", "street_address"])).min(1),
});

/** Client operational contact. Never rendered into a public log, page, or CRM record. */
export const EscalationContactSchema = z.strictObject({
  name: configuredString(120),
  phone: e164PhoneSchema,
  role: configuredString(80).optional(),
});

const RecordingPolicySchema = z.union([
  z.strictObject({ enabled: z.literal(false) }),
  z.strictObject({
    enabled: z.literal(true),
    disclosure: configuredString(600),
    continuationStatement: configuredString(600),
    retentionDays: z.number().int().min(1).max(3650),
  }),
]);

/**
 * Consent posture. The disclosure text is the tenant's, not ours, and a
 * recording posture recorded here is an operational record — it is not a legal
 * determination that consent requirements are met.
 */
export const ConsentPolicySchema = z.strictObject({
  aiDisclosure: configuredString(600),
  transcription: z.strictObject({ enabled: z.boolean() }),
  recording: RecordingPolicySchema,
  refusal: z.strictObject({
    acknowledgement: configuredString(600),
    stopRecordingWhenSupported: z.boolean(),
    offer: z.enum(["transfer_or_callback", "transfer_only", "callback_only"]),
    minimizeCollection: z.literal(true),
  }),
});

export const QuotePhotoSubmissionSchema = z.strictObject({
  email: z.email(),
  purpose: configuredString(200),
  temporary: z.boolean(),
  reviewRequired: z.boolean(),
});

export const CompletedInteractionRecipientSchema = z.strictObject({
  channel: z.literal("email"),
  recipient: z.email(),
  event: z.literal("completed_interaction"),
  enabled: z.boolean(),
  temporary: z.boolean(),
});

export const BusinessKnowledgeSchema = z.strictObject({
  facts: z.array(z.strictObject({ topic: configuredString(120), statement: configuredString(1200), sourceRef: configuredString(300) })).min(1).max(40),
  fictionalScenarios: z.array(z.strictObject({ reference: configuredString(100), statement: configuredString(1000), fictional: z.literal(true) })).max(10),
}).refine((value) => value.facts.reduce((size, fact) => size + fact.topic.length + fact.statement.length + fact.sourceRef.length, 0) + value.fictionalScenarios.reduce((size, item) => size + item.reference.length + item.statement.length, 0) <= 16000, "Business knowledge exceeds the bounded demonstration context.");

export const OPERATING_CONFIGURATION_VALUE_SCHEMAS = {
  "business.knowledge": BusinessKnowledgeSchema,
  "operating_hours.weekly": WeeklyOperatingHoursSchema,
  "operating_hours.holidays": HolidayOperatingHoursSchema,
  "service_area.coverage": ServiceAreaCoverageSchema,
  "contact.escalation.primary": EscalationContactSchema,
  "policy.consent": ConsentPolicySchema,
  "quote.photo_submission.email": QuotePhotoSubmissionSchema,
  "notification.completed_interaction.recipient": CompletedInteractionRecipientSchema,
} as const;

export type OperatingConfigurationKey = keyof typeof OPERATING_CONFIGURATION_VALUE_SCHEMAS;

export type OperatingConfigurationValue<K extends OperatingConfigurationKey> =
  z.infer<(typeof OPERATING_CONFIGURATION_VALUE_SCHEMAS)[K]>;

export const OPERATING_CONFIGURATION_KEYS = Object.freeze(
  Object.keys(OPERATING_CONFIGURATION_VALUE_SCHEMAS) as OperatingConfigurationKey[],
);

export function isOperatingConfigurationKey(value: unknown): value is OperatingConfigurationKey {
  return typeof value === "string" && Object.hasOwn(OPERATING_CONFIGURATION_VALUE_SCHEMAS, value);
}

/** Which typed key satisfies each readiness requirement. */
const REQUIREMENT_SATISFIED_BY: Readonly<Record<string, readonly OperatingConfigurationKey[]>> = Object.freeze({
  "operating_hours.weekly": Object.freeze(["operating_hours.weekly"] as const),
  "operating_hours.holidays": Object.freeze(["operating_hours.holidays"] as const),
  "service_area.coverage": Object.freeze(["service_area.coverage"] as const),
  "contact.escalation": Object.freeze(["contact.escalation.primary"] as const),
  "policy.consent": Object.freeze(["policy.consent"] as const),
});

export interface OperatingConfigurationReadiness {
  ready: boolean;
  missing: string[];
  conflicts: string[];
}

export function parseOperatingConfigurationValue<K extends OperatingConfigurationKey>(
  key: K,
  value: unknown,
): { ok: true; value: OperatingConfigurationValue<K> } | { ok: false; error: string } {
  const parsed = OPERATING_CONFIGURATION_VALUE_SCHEMAS[key].safeParse(value);
  if (parsed.success) return { ok: true, value: parsed.data as OperatingConfigurationValue<K> };
  const issue = parsed.error.issues[0];
  const path = issue?.path.join(".");
  return { ok: false, error: `${key}${path ? `.${path}` : ""}: ${issue?.message ?? "invalid_value"}` };
}

function snapshotFacts(memory: BusinessMemorySnapshot) {
  return [
    ...memory.businessProfile,
    ...memory.services,
    ...memory.locations,
    ...memory.operatingHours,
    ...memory.serviceAreas,
    ...memory.faqs,
    ...memory.policies,
    ...memory.contactPaths,
    ...memory.brandVoice,
  ];
}

/**
 * Reads one typed configuration value from an approved snapshot. Returns null
 * when the key is absent or its value does not parse, so a malformed value
 * behaves like an unconfigured one rather than reaching the agent.
 */
export function readOperatingConfigurationValue<K extends OperatingConfigurationKey>(
  memory: BusinessMemorySnapshot | null | undefined,
  key: K,
): OperatingConfigurationValue<K> | null {
  if (!memory) return null;
  for (const fact of snapshotFacts(memory)) {
    if (fact.key !== key) continue;
    const parsed = parseOperatingConfigurationValue(key, fact.value);
    if (parsed.ok) return parsed.value;
  }
  return null;
}

/**
 * An unrecognised mode is evaluated against the supervised requirements rather
 * than the demo lane's empty list, so a typo cannot report a tenant as ready.
 *
 * A requirement counts as satisfied only when its typed key carries a value
 * that parses. Before ADR-0052 any non-empty value counted, which let a free
 * text note stand in for a machine-readable schedule or consent posture.
 */
export function evaluateOperatingConfiguration(
  memory: BusinessMemorySnapshot,
  mode: unknown,
): OperatingConfigurationReadiness {
  const required = isExecutionMode(mode)
    ? OPERATING_CONFIGURATION_REQUIREMENTS[mode]
    : SUPERVISED_OPERATING_CONFIGURATION;
  const missing = required.filter((requirement) => {
    const keys = REQUIREMENT_SATISFIED_BY[requirement] ?? [];
    return !keys.some((key) => readOperatingConfigurationValue(memory, key) !== null);
  });
  return {
    ready: missing.length === 0 && memory.conflicts.length === 0,
    missing,
    conflicts: [...memory.conflicts],
  };
}
