import { RECEPTIONIST_CAPABILITY } from "./descriptors/receptionist";
import { INBOUND_LEAD_QUALIFICATION_CAPABILITY } from "./descriptors/inboundLeadQualification";
import type { CapabilityDescriptor } from "./contract";

export type {
  CapabilityDescriptor,
  CapabilityTrigger,
  CapabilityRecord,
} from "./contract";
export { capabilityChecksum } from "./contract";
export {
  validateCapabilityGovernance,
  effectiveAllowedTools,
  readinessGate,
  type CapabilityGovernanceResult,
} from "./validate";
export { RECEPTIONIST_CAPABILITY } from "./descriptors/receptionist";
export { INBOUND_LEAD_QUALIFICATION_CAPABILITY } from "./descriptors/inboundLeadQualification";

/**
 * Every capability described in Git. A plain frozen array rather than a lookup
 * service: two entries do not justify a registry abstraction, and a registry is
 * exactly the kind of scaffolding ADR-0054 decision 8 defers until repetition
 * proves it necessary.
 */
export const CAPABILITIES: readonly CapabilityDescriptor[] = Object.freeze([
  RECEPTIONIST_CAPABILITY,
  INBOUND_LEAD_QUALIFICATION_CAPABILITY,
]);
