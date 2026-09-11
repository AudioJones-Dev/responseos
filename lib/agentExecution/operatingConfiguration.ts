import type { BusinessMemorySnapshot } from "@/lib/prospectBootstrap/contracts";
import { isExecutionMode, type ExecutionMode } from "./policy";

/**
 * Operating configuration a tenant's memory snapshot must carry before a mode
 * may be activated (ADR-0051 decision 3). Each entry is a fact key, matched
 * exactly or as a whole leading segment, using the key prefixes the snapshot
 * compiler already routes into sections. A matching fact counts only if it
 * carries a value; the value's shape is not checked.
 *
 * This reports readiness only. It never opens an activation gate; those stay
 * in `EXECUTION_MODE_ACTIVATION_GATES` and the roadmap.
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

export interface OperatingConfigurationReadiness {
  ready: boolean;
  missing: string[];
  conflicts: string[];
}

// An empty list is a value: `operating_hours.holidays: []` records that no holiday closures apply.
function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return true;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

/**
 * An unrecognised mode is evaluated against the supervised requirements rather
 * than the demo lane's empty list, so a typo cannot report a tenant as ready.
 */
export function evaluateOperatingConfiguration(
  memory: BusinessMemorySnapshot,
  mode: unknown,
): OperatingConfigurationReadiness {
  const required = isExecutionMode(mode)
    ? OPERATING_CONFIGURATION_REQUIREMENTS[mode]
    : SUPERVISED_OPERATING_CONFIGURATION;
  const keys = [
    ...memory.businessProfile,
    ...memory.services,
    ...memory.locations,
    ...memory.operatingHours,
    ...memory.serviceAreas,
    ...memory.faqs,
    ...memory.policies,
    ...memory.contactPaths,
    ...memory.brandVoice,
  ]
    .filter((fact) => hasValue(fact.value))
    .map((fact) => fact.key);
  const missing = required.filter((requirement) => (
    !keys.some((key) => key === requirement || key.startsWith(`${requirement}.`))
  ));
  return {
    ready: missing.length === 0 && memory.conflicts.length === 0,
    missing,
    conflicts: [...memory.conflicts],
  };
}
