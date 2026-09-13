import { PROSPECT_DEMO_POLICY } from "@/lib/prospectBootstrap/policy";
import { PROSPECT_RECEPTIONIST_TEMPLATE } from "@/lib/prospectBootstrap/template";
import { EXECUTION_MODE_ACTIVATION_GATES } from "@/lib/agentExecution/policy";
import type { CapabilityDescriptor } from "../contract";

/**
 * Capability #1 — the shipped prospect-demo receptionist.
 *
 * This descriptor *wraps* the existing template and policy; it never redefines
 * them. `PROSPECT_DEMO_POLICY`'s shape and values are byte-compared against a
 * stored `AgentProfile.system_policy_json` in `lib/prospectBootstrap/service.ts`,
 * and the template checksum is surfaced in the admin UI — so `allowedTools` and
 * the version label are *read from* those constants rather than restated. A
 * restatement would be a second source of truth that could drift silently.
 *
 * Describing an existing capability changes nothing about how it runs. The
 * prospect-demo lane pushes a prompt to a provider assistant; this descriptor
 * does not execute it.
 */
export const RECEPTIONIST_CAPABILITY: CapabilityDescriptor = Object.freeze({
  slug: "prospect-receptionist",
  name: "Prospect Demo Receptionist",
  versionLabel: PROSPECT_RECEPTIONIST_TEMPLATE.version,
  objective:
    "Answer inbound calls using only operator-approved business facts, and capture a human callback request when the approved context cannot answer.",
  triggers: Object.freeze(["inbound_call"] as const),
  requiredContext: Object.freeze([
    "account",
    "business_memory_snapshot",
  ] as const),
  // The receptionist's evidence rule is `knowledgeFallback: "verified_only"` —
  // only facts carried by the approved snapshot may be spoken.
  requiredKnownFields: Object.freeze(["approved_business_context"] as const),
  minimumExecutionMode: "PROSPECT_DEMO",
  allowedTools: PROSPECT_DEMO_POLICY.allowedTools,
  producesRecords: Object.freeze([
    "Contact",
    "Call",
    "CallTranscript",
    "LeadEvent",
  ] as const),
  readinessGate: EXECUTION_MODE_ACTIVATION_GATES.PROSPECT_DEMO,
});
