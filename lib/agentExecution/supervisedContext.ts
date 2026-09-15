import { z } from "zod";
import type { BusinessMemorySnapshot } from "@/lib/prospectBootstrap/contracts";
import {
  readOperatingConfigurationValue,
  type OperatingConfigurationValue,
} from "./operatingConfiguration";
import type { ExecutionPolicy } from "./policy";

/**
 * Dynamic variables handed to a supervised tenant's assistant (ADR-0057).
 *
 * Two rules govern what may appear here. Everything the agent may say comes
 * from approved configuration, and client operational contacts never do: the
 * escalation phone number and the notification recipient stay in the database
 * and are never sent to the provider, logged, or rendered.
 */
export const SupervisedAgentContextSchema = z.object({
  supervised_available: z.literal("true"),
  execution_mode: z.string().min(1),
  agent_name: z.string().min(1),
  business_name: z.string().min(1),
  approved_business_context: z.string().min(1).max(24_000),
  knowledge_as_of: z.iso.datetime(),
  uncertainty_fallback: z.string().min(1),
  ai_disclosure: z.string().min(1),
  recording_enabled: z.enum(["true", "false"]),
  recording_disclosure: z.string(),
  recording_continuation: z.string(),
  recording_refusal_acknowledgement: z.string(),
  recording_refusal_offer: z.string(),
  service_area_statement: z.string().min(1),
  location_confirmation_required: z.enum(["true", "false"]),
  operating_hours_statement: z.string().min(1),
  quote_photo_submission_email: z.string(),
  transfer_enabled: z.enum(["true", "false"]),
  closing_statement: z.string().min(1),
});

export type SupervisedAgentContext = z.infer<typeof SupervisedAgentContextSchema>;

/**
 * Spoken when a call reaches a number whose tenant cannot be resolved, is not
 * ready, or is not activated. Deliberately neutral and free of demo wording:
 * a real client's caller must never hear demonstration copy. The tenant's own
 * wording replaces this once the operator approves one.
 */
const UNAVAILABLE_MESSAGE =
  "I'm not able to take details on this call. Please call back shortly and someone will help you.";

// Every variable the attested template can reference is present, so the
// fail-closed context never renders an unresolved placeholder; the template's
// first instruction reads `supervised_available` and terminates the call.
export const SupervisedUnavailableContextSchema = z.object({
  supervised_available: z.literal("false"),
  execution_mode: z.literal("SUPERVISED_UNAVAILABLE"),
  agent_name: z.literal("Assistant"),
  business_name: z.literal("this business"),
  approved_business_context: z.literal("No approved business information is available for this call."),
  knowledge_as_of: z.literal("1970-01-01T00:00:00.000Z"),
  uncertainty_fallback: z.literal(UNAVAILABLE_MESSAGE),
  ai_disclosure: z.literal(UNAVAILABLE_MESSAGE),
  recording_enabled: z.literal("false"),
  recording_disclosure: z.literal(""),
  recording_continuation: z.literal(""),
  recording_refusal_acknowledgement: z.literal(""),
  recording_refusal_offer: z.literal(""),
  service_area_statement: z.literal("No service area information is available for this call."),
  location_confirmation_required: z.literal("false"),
  operating_hours_statement: z.literal("No operating hours are available for this call."),
  quote_photo_submission_email: z.literal(""),
  transfer_enabled: z.literal("false"),
  closing_statement: z.literal(UNAVAILABLE_MESSAGE),
});

export const SUPERVISED_UNAVAILABLE_CONTEXT = SupervisedUnavailableContextSchema.parse({
  supervised_available: "false",
  execution_mode: "SUPERVISED_UNAVAILABLE",
  agent_name: "Assistant",
  business_name: "this business",
  approved_business_context: "No approved business information is available for this call.",
  knowledge_as_of: "1970-01-01T00:00:00.000Z",
  uncertainty_fallback: UNAVAILABLE_MESSAGE,
  ai_disclosure: UNAVAILABLE_MESSAGE,
  recording_enabled: "false",
  recording_disclosure: "",
  recording_continuation: "",
  recording_refusal_acknowledgement: "",
  recording_refusal_offer: "",
  service_area_statement: "No service area information is available for this call.",
  location_confirmation_required: "false",
  operating_hours_statement: "No operating hours are available for this call.",
  quote_photo_submission_email: "",
  transfer_enabled: "false",
  closing_statement: UNAVAILABLE_MESSAGE,
});

const DAY_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

function weeklyHoursStatement(value: OperatingConfigurationValue<"operating_hours.weekly"> | null): string {
  if (!value) return "Operating hours are not configured; a person will confirm them.";
  if (value.type === "always_open") return "Open 24 hours a day, 7 days a week.";
  const days = [...value.days].sort((left, right) => DAY_ORDER.indexOf(left.day) - DAY_ORDER.indexOf(right.day));
  return `Hours (${value.timezone}): ${days
    .map((day) => (day.closed ? `${day.day} closed` : `${day.day} ${day.opensAt}-${day.closesAt}`))
    .join("; ")}.`;
}

function holidayStatement(value: OperatingConfigurationValue<"operating_hours.holidays"> | null): string {
  if (!value) return "";
  if (value.type === "always_open") return "Open on holidays.";
  return `Holiday closures (${value.timezone}): ${value.closures
    .map((closure) => `${closure.date} ${closure.name}${closure.closed ? " closed" : " open"}`)
    .join("; ")}.`;
}

/**
 * The configured refusal offer is an enum; the template speaks this value
 * word for word, so it must be a sentence. Every branch offers a person and
 * collects nothing: a callback goes to the number the caller is calling
 * from, which the ledger already holds. A transfer is offered only when the
 * policy actually enables the transfer tool.
 */
function refusalOfferStatement(
  offer: OperatingConfigurationValue<"policy.consent">["refusal"]["offer"] | null,
  transferEnabled: boolean,
): string {
  const callback = "A person will call you back at the number you are calling from.";
  const transfer = "I can connect you with a person now.";
  if (!offer) return "";
  if (offer === "callback_only" || !transferEnabled) return callback;
  if (offer === "transfer_only") return transfer;
  return `${transfer} Or, if you prefer, a person will call you back at the number you are calling from. Which would you like?`;
}

function serviceAreaStatement(value: OperatingConfigurationValue<"service_area.coverage"> | null): string {
  if (!value) return "Service area is not configured; a person will confirm coverage.";
  const collect = value.collectFromCaller
    .map((field) => (field === "postal_code" ? "postal code" : field.replace("_", " ")))
    .join(" and ");
  return `Service area: ${value.regions.join(", ")}. Do not infer coverage from a county or city name. Ask for the caller's ${collect}, and say a person will confirm whether the address is covered.`;
}

export function buildSupervisedAgentContext(params: {
  businessName: string;
  agentName: string;
  memory: BusinessMemorySnapshot;
  policy: ExecutionPolicy;
}): SupervisedAgentContext {
  const knowledge = readOperatingConfigurationValue(params.memory, "business.knowledge");
  const weekly = readOperatingConfigurationValue(params.memory, "operating_hours.weekly");
  const holidays = readOperatingConfigurationValue(params.memory, "operating_hours.holidays");
  const coverage = readOperatingConfigurationValue(params.memory, "service_area.coverage");
  const consent = readOperatingConfigurationValue(params.memory, "policy.consent");
  const photo = readOperatingConfigurationValue(params.memory, "quote.photo_submission.email");
  const recording = params.policy.recordingEnabled && consent?.recording.enabled === true ? consent.recording : null;

  const hoursStatement = [weeklyHoursStatement(weekly), holidayStatement(holidays)]
    .filter(Boolean)
    .join(" ");
  const areaStatement = serviceAreaStatement(coverage);

  const approvedContext = [
    `Business: ${params.businessName}`,
    "This is an isolated supervised demonstration. Business facts are approved; customer and project examples are fictional.",
    ...(knowledge?.facts.map((fact) => `APPROVED FACT [${fact.sourceRef}] ${fact.topic}: ${fact.statement}`) ?? []),
    ...(knowledge?.fictionalScenarios.map((scenario) => `FICTIONAL DEMO RECORD [${scenario.reference}]: ${scenario.statement}. Discuss only after the caller supplies this exact demonstration reference; never treat it as a real customer record.`) ?? []),
    `Agent: ${params.agentName}`,
    hoursStatement,
    areaStatement,
    photo ? `Photos for a quote may be emailed to ${photo.email}. ${photo.purpose}` : null,
    ...params.memory.unknowns.map((unknown) => `UNKNOWN: ${unknown}`),
    ...params.memory.agentBoundaries.map((boundary) => `BOUNDARY: ${boundary}`),
  ]
    .filter(Boolean)
    .join("\n");

  return SupervisedAgentContextSchema.parse({
    supervised_available: "true",
    execution_mode: params.policy.executionMode,
    agent_name: params.agentName,
    business_name: params.businessName,
    approved_business_context: approvedContext,
    knowledge_as_of: params.memory.generatedAt,
    uncertainty_fallback: params.policy.uncertaintyFallback,
    ai_disclosure: consent?.aiDisclosure ?? params.policy.requiredDisclosure,
    recording_enabled: params.policy.recordingEnabled ? "true" : "false",
    recording_disclosure: recording?.disclosure ?? "",
    recording_continuation: recording?.continuationStatement ?? "",
    recording_refusal_acknowledgement: consent?.refusal.acknowledgement ?? "",
    recording_refusal_offer: refusalOfferStatement(consent?.refusal.offer ?? null, params.policy.transferEnabled),
    service_area_statement: areaStatement,
    location_confirmation_required: coverage?.locationConfirmationRequired ? "true" : "false",
    operating_hours_statement: hoursStatement,
    quote_photo_submission_email: photo?.email ?? "",
    transfer_enabled: params.policy.transferEnabled ? "true" : "false",
    // Phase A closing only: thank the caller and set the follow-up expectation.
    // No satisfaction survey is asked on a live client call.
    closing_statement: `Thank you for calling ${params.businessName}. A member of the team will follow up.`,
  });
}
