import { PROSPECT_AGENT_TEMPLATE_VERSION } from "./contracts";

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
