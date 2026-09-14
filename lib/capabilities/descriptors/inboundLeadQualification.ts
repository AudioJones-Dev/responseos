import type { CapabilityDescriptor } from "../contract";

/**
 * Capability #2 — inbound lead qualification.
 *
 * Chosen over missed-call recovery on gate evidence: recovery's core action is
 * outbound contact, and `outboundEnabled` is `false` at every execution mode
 * except `MANAGED_AUTONOMY`, whose gate is `post-pilot-operator-authorization`.
 * Inbound is permitted at every mode, and the qualification tail is already
 * modelled — `leadQualificationScore`, `LeadQualification`, `QualificationStatus`.
 *
 * Booking is deliberately **not** part of this capability. `schedulingEnabled`
 * is false below `PRODUCTION_SUPERVISED`, which sits behind the open
 * v0.3 gate, so the capability terminates at a qualification outcome.
 *
 * `allowedTools` is empty and that is meaningful rather than a placeholder:
 * qualification writes internal records only and calls no provider tool. Under
 * the intersection rule (ADR-0058 decision 5) an empty set stays empty at every
 * mode, so this capability cannot acquire a tool by being assigned to a more
 * permissive tenant.
 *
 * Describing the capability does not implement it. The score divergence this
 * descriptor exposes — `app/api/leads/[id]/qualify/route.ts` uses the
 * deterministic weighted rule while `lib/providers/telnyx/normalize.ts` trusts
 * a provider-supplied number — is documented in the assessment and is
 * Increment 2's subject, not this file's.
 */
export const INBOUND_LEAD_QUALIFICATION_CAPABILITY: CapabilityDescriptor = Object.freeze({
  slug: "inbound-lead-qualification",
  name: "Inbound Lead Qualification",
  versionLabel: "inbound-lead-qualification.v1",
  objective:
    "Convert an inbound enquiry into a scored, evidence-backed qualification outcome using a deterministic rule rather than a model-supplied score.",
  triggers: Object.freeze(["inbound_call", "lead_form"] as const),
  requiredContext: Object.freeze([
    "account",
    "contact",
    "lead_event",
    "service_area",
  ] as const),
  // Mirrors the mandatory inputs of `leadQualificationScore`, not the columns
  // that happen to look important. `LeadQualificationInput` requires
  // `serviceAreaMatch` and `urgency` — the latter indexes `URGENCY_WEIGHT`
  // directly, so a missing value scores `undefined`. `serviceRequested` is
  // optional there (worth 10 of 100 when present) and is therefore *not*
  // required here, despite `service_needed` being the more obvious-looking
  // field. An earlier draft listed `service_needed` and omitted `urgency`,
  // which would have rejected scoreable leads and admitted unscoreable ones
  // the moment anything started trusting this list. Raised by Codex on #174.
  requiredKnownFields: Object.freeze([
    "service_area_match",
    "urgency",
  ] as const),
  minimumExecutionMode: "PROSPECT_DEMO",
  allowedTools: Object.freeze([] as const),
  producesRecords: Object.freeze(["LeadEvent", "LeadQualification"] as const),
});
