import { createHash } from "node:crypto";
import { normalizeE164 } from "@/lib/validation/common";

/** Provider preflight must attest the reviewed template, disabled recording, and verified capture controls. */
export const SUPERVISED_RECEPTIONIST_TEMPLATE_VERSION = "supervised-receptionist.v3";

export const SUPERVISED_RECEPTIONIST_TEMPLATE = Object.freeze({
  version: SUPERVISED_RECEPTIONIST_TEMPLATE_VERSION,
  instructions: [
    "If supervised_available is false: say only this, word for word, then end the call with the hangup tool and do nothing else on this call: {{uncertainty_fallback}}",
    "You are {{agent_name}}, the inbound receptionist for {{business_name}}, operating under human supervision.",
    "Before collecting or transcribing anything, say this approved disclosure word for word: {{ai_disclosure}}",
    "If recording_enabled is true, then also say word for word: {{recording_disclosure}}",
    "Then ask, and wait for the answer: 'Is it okay to continue?' Continue only on a clear yes. If the caller says no, hesitates, asks not to be recorded or transcribed, or gives no clear answer, say word for word: {{recording_refusal_acknowledgement}} Then offer only this: {{recording_refusal_offer}} Do not ask for or record any details after a refusal or an unclear answer.",
    "APPROVED OPERATING CONFIGURATION (reviewed {{knowledge_as_of}}):",
    "{{approved_business_context}}",
    "State only what that configuration supports. If it does not answer the question, say: {{uncertainty_fallback}}",
    "Never infer a service area. Collect only the location details this statement names, and say a person will confirm coverage: {{service_area_statement}}",
    "Ask who is calling, whether they are new or existing, their reason, and the relevant product. Adapt questions to homeowner, builder/GC or commercial caller.",
    "Handle new_sales, existing_customer_new_sale, new_service, existing_service, project_coordination, and administrative intake. Do not use a sales interview for service or administration.",
    "For VPL, vehicle lift, ceiling lift and ramp inquiries, ask only the approved product-specific questions. Unknown compatibility and price require human review.",
    "Do not reveal a fictional project record unless the caller provides its exact demonstration reference. Never claim to have accessed real customer history.",
    "Do not persist transcription before affirmative consent. Refusal or withdrawal must stop capture through the verified provider control, not just this prompt. Audio recording stays disabled.",
    "Explain that an operator reviews follow-up before CRM or email delivery. Offer a callback; do not claim a live transfer or appointment was completed.",
    "Capture the caller's name, callback number, relationship to the business, and what they are calling about.",
    "Never quote a binding price, promise a date, or confirm an appointment.",
    "Offer a person whenever the caller asks, is distressed, or the request falls outside the configuration.",
    "Never give medical, legal, financial, emergency, or other regulated advice.",
  ].join("\n"),
  dynamicVariables: [
    "supervised_available",
    "agent_name",
    "business_name",
    "execution_mode",
    "approved_business_context",
    "knowledge_as_of",
    "uncertainty_fallback",
    "ai_disclosure",
    "recording_enabled",
    "recording_disclosure",
    "recording_continuation",
    "recording_refusal_acknowledgement",
    "recording_refusal_offer",
    "service_area_statement",
    "location_confirmation_required",
    "operating_hours_statement",
    "quote_photo_submission_email",
    "transfer_enabled",
    "closing_statement",
  ],
  allowedTools: ["hangup", "transfer"],
  providerMemoryEnabled: false,
  outboundEnabled: false,
});

export const SUPERVISED_RECEPTIONIST_TEMPLATE_CHECKSUM = createHash("sha256")
  .update(JSON.stringify(SUPERVISED_RECEPTIONIST_TEMPLATE))
  .digest("hex");

export interface SupervisedAssistantPreflightExpectation {
  recordingEnabled: boolean;
  allowedTools: readonly string[];
  /** The approved escalation contact; required whenever `transfer` is a policy tool. */
  transferDestination?: string | null;
}

export interface SupervisedAssistantPreflightMetadata {
  assistantId: string;
  templateVersion: string;
  templateChecksum: string;
  initializationWebhookConfigured: boolean;
  recordingEnabled: boolean;
  providerMemoryEnabled: boolean;
  allowedTools: string[];
  insightGroupConfigured?: boolean;
  messageHistoryUpdatesEnabled?: boolean;
  numberRecordingEnabled?: boolean;
  consentCaptureVerified?: boolean;
  captureIntervalVerified?: boolean;
  consentEvidenceRef?: string;
  /** Where the provider's `transfer` tool actually sends the caller. */
  transferDestinationE164?: string;
}

/**
 * Asserts that the attested provider configuration matches the policy this
 * tenant resolved to. Every check is against attested provider state, never
 * against the agent's script — an instruction to disclose recording is not
 * evidence that recording is configured the way the tenant approved.
 */
export function validateSupervisedAssistantPreflight(
  value: unknown,
  expected: SupervisedAssistantPreflightExpectation,
): SupervisedAssistantPreflightMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("assistant_preflight_missing");
  const metadata = value as Partial<SupervisedAssistantPreflightMetadata>;
  if (typeof metadata.assistantId !== "string" || !metadata.assistantId.trim()) throw new Error("assistant_id_missing");
  if (metadata.templateVersion !== SUPERVISED_RECEPTIONIST_TEMPLATE_VERSION) throw new Error("assistant_template_version_mismatch");
  if (metadata.templateChecksum !== SUPERVISED_RECEPTIONIST_TEMPLATE_CHECKSUM) throw new Error("assistant_template_checksum_mismatch");
  if (metadata.initializationWebhookConfigured !== true) throw new Error("assistant_initialization_webhook_missing");
  if (metadata.providerMemoryEnabled !== false) throw new Error("assistant_provider_memory_must_be_disabled");
  if (metadata.recordingEnabled !== expected.recordingEnabled) throw new Error("assistant_recording_policy_mismatch");
  // Telnyx records assistant calls by default and the number carries its own
  // recording switch, so both have to agree with the tenant's posture.
  if (metadata.numberRecordingEnabled !== expected.recordingEnabled) throw new Error("number_recording_policy_mismatch");
  if (metadata.insightGroupConfigured !== true) throw new Error("assistant_insight_group_missing");
  if (metadata.messageHistoryUpdatesEnabled !== true) throw new Error("assistant_message_history_updates_missing");
  if (!Array.isArray(metadata.allowedTools)) throw new Error("assistant_tools_missing");
  const permitted = new Set(expected.allowedTools);
  if (metadata.allowedTools.some((tool) => !permitted.has(tool))) throw new Error("assistant_tools_exceed_policy");
  // The policy's tools are promises the context makes to the caller (a human
  // transfer, for one), so the provider must attest every one of them.
  const attested = new Set(metadata.allowedTools);
  if (expected.allowedTools.some((tool) => !attested.has(tool))) throw new Error("assistant_tools_missing_policy_tool");
  // A tool named `transfer` proves nothing about where it sends the caller;
  // the attested destination must be the approved escalation contact.
  if (permitted.has("transfer")) {
    const expectedDestination = expected.transferDestination ? normalizeE164(expected.transferDestination) : null;
    if (!expectedDestination) throw new Error("escalation_contact_required_for_transfer");
    const attestedDestination = typeof metadata.transferDestinationE164 === "string" ? normalizeE164(metadata.transferDestinationE164) : null;
    if (attestedDestination !== expectedDestination) throw new Error("assistant_transfer_destination_mismatch");
  }
  if (metadata.consentCaptureVerified !== true || metadata.captureIntervalVerified !== true || !metadata.consentEvidenceRef?.trim()) throw new Error("consent_transport_not_verified");
  return metadata as SupervisedAssistantPreflightMetadata;
}
