import { createHash } from "node:crypto";
import { PROSPECT_AGENT_TEMPLATE_VERSION } from "./contracts";
import { PROSPECT_DEMO_POLICY } from "./policy";

export const PROSPECT_RECEPTIONIST_TEMPLATE = Object.freeze({
  version: PROSPECT_AGENT_TEMPLATE_VERSION,
  greeting: "Thanks for calling {{business_name}}. This is an automated ResponseOS prospect demonstration, and this call may be transcribed but is not being recorded. How can I help?",
  instructions: [
    "You are the inbound receptionist for {{business_name}} in a supervised PROSPECT DEMO.",
    "The only business facts you may state are in APPROVED BUSINESS CONTEXT below.",
    "APPROVED BUSINESS CONTEXT (reviewed {{knowledge_as_of}}):",
    "{{approved_business_context}}",
    `If the context does not directly support an answer, say exactly: ${PROSPECT_DEMO_POLICY.uncertaintyFallback}`,
    "Never infer a service, location, operating hour, price, policy, availability, credential, or promise.",
    "Published prices are non-binding website observations and always require human confirmation.",
    "You may collect basic qualification details and a human callback request.",
    "Do not schedule, transfer, take payment, write to a CRM, dial outbound, or give medical, legal, financial, emergency, or regulated advice.",
    "The only operational tool available is hangup.",
  ].join("\n"),
  dynamicVariables: [
    "business_name",
    "business_website",
    "approved_business_context",
    "knowledge_as_of",
    "uncertainty_fallback",
    "execution_mode",
    "demo_available",
  ],
  allowedTools: ["hangup"],
  recordingEnabled: false,
  providerMemoryEnabled: false,
});

export const PROSPECT_RECEPTIONIST_TEMPLATE_CHECKSUM = createHash("sha256")
  .update(JSON.stringify(PROSPECT_RECEPTIONIST_TEMPLATE))
  .digest("hex");

export interface ProspectAssistantPreflightMetadata {
  assistantId: string;
  templateVersion: string;
  templateChecksum: string;
  initializationWebhookConfigured: boolean;
  recordingEnabled: boolean;
  providerMemoryEnabled: boolean;
  allowedTools: string[];
}

export function validateProspectAssistantPreflight(value: unknown): ProspectAssistantPreflightMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("assistant_preflight_missing");
  const metadata = value as Partial<ProspectAssistantPreflightMetadata>;
  if (typeof metadata.assistantId !== "string" || !metadata.assistantId.trim()) throw new Error("assistant_id_missing");
  if (metadata.templateVersion !== PROSPECT_RECEPTIONIST_TEMPLATE.version) throw new Error("assistant_template_version_mismatch");
  if (metadata.templateChecksum !== PROSPECT_RECEPTIONIST_TEMPLATE_CHECKSUM) throw new Error("assistant_template_checksum_mismatch");
  if (metadata.initializationWebhookConfigured !== true) throw new Error("assistant_initialization_webhook_missing");
  if (metadata.recordingEnabled !== false) throw new Error("assistant_recording_must_be_disabled");
  if (metadata.providerMemoryEnabled !== false) throw new Error("assistant_provider_memory_must_be_disabled");
  if (!Array.isArray(metadata.allowedTools) || metadata.allowedTools.length !== 1 || metadata.allowedTools[0] !== "hangup") {
    throw new Error("assistant_tools_must_be_hangup_only");
  }
  return metadata as ProspectAssistantPreflightMetadata;
}
