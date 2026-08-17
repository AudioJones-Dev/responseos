export type MarketingEventName =
  | "homepage_estimator_started"
  | "homepage_estimator_completed"
  | "homepage_estimate_audit_clicked"
  | "homepage_nav_audit_clicked"
  | "homepage_demo_clicked"
  | "audit_prefill_loaded"
  | "audit_request_submitted";

export function recordMarketingEvent(name: MarketingEventName): void {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent("responseos:marketing", {
      detail: { name },
    }),
  );
}
