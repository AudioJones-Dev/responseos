import type { ProspectBootstrapStatus } from "./contracts";

const TRANSITIONS: Readonly<Record<ProspectBootstrapStatus, readonly ProspectBootstrapStatus[]>> = {
  draft: ["ingesting", "expired"],
  ingesting: ["review_required", "failed", "expired"],
  review_required: ["ingesting", "approved", "failed", "expired"],
  approved: ["provisioning", "expired"],
  provisioning: ["ready", "failed", "expired"],
  ready: ["active", "expired"],
  active: ["completed", "expired"],
  completed: ["promotion_pending", "expired"],
  promotion_pending: ["converted", "expired"],
  converted: [],
  expired: ["cleanup_pending"],
  cleanup_pending: ["cleaned", "failed"],
  cleaned: [],
  failed: ["review_required", "cleanup_pending", "expired"],
};

export function canTransitionProspectBootstrap(
  current: ProspectBootstrapStatus,
  next: ProspectBootstrapStatus,
): boolean {
  return TRANSITIONS[current].includes(next);
}

export function assertProspectBootstrapTransition(
  current: ProspectBootstrapStatus,
  next: ProspectBootstrapStatus,
): void {
  if (!canTransitionProspectBootstrap(current, next)) {
    throw new Error(`invalid_bootstrap_transition:${current}:${next}`);
  }
}

export function isTerminalProspectBootstrapStatus(status: ProspectBootstrapStatus): boolean {
  return status === "converted" || status === "cleaned";
}
