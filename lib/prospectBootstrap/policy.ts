import { PROSPECT_AGENT_TEMPLATE_VERSION } from "./contracts";

export const PROSPECT_DEMO_ALLOWED_ACTIONS = Object.freeze([
  "Answer inbound calls using operator-approved business facts.",
  "Explain verified services, locations, hours, policies, and contact paths.",
  "Collect basic lead qualification details and a human callback request.",
  "Capture a transcript and demo evidence under the 30-day retention policy.",
  "End the call with the hangup tool.",
]);

export const PROSPECT_DEMO_PROHIBITED_ACTIONS = Object.freeze([
  "Outbound dialing or campaigns.",
  "Scheduling or changing a live calendar.",
  "Collecting payment, quoting binding prices, or making commitments.",
  "Writing to CRM or any prospect production system.",
  "Transferring calls or impersonating unavailable human authority.",
  "Medical, legal, financial, emergency, or other regulated advice.",
  "Using provider memory or any fact outside the approved snapshot.",
]);

export const PROSPECT_DEMO_POLICY = Object.freeze({
  executionMode: "PROSPECT_DEMO",
  templateVersion: PROSPECT_AGENT_TEMPLATE_VERSION,
  inboundOnly: true,
  recordingEnabled: false,
  crmSyncEnabled: false,
  schedulingEnabled: false,
  paymentEnabled: false,
  outboundEnabled: false,
  transferEnabled: false,
  providerMemoryEnabled: false,
  allowedTools: ["hangup"],
  requiredDisclosure: "This is an automated ResponseOS demonstration. This call may be transcribed for the supervised demonstration, but it is not being recorded.",
  uncertaintyFallback: "I don't have verified information available for that. I can capture a request for a human callback.",
  prohibitedAdvice: ["medical", "legal", "financial", "emergency"],
});

export function isProspectDemoCrmSyncAllowed(): false {
  return false;
}
