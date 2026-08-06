/** SchedulingProvider — Calendly MVP (mock-only). */

export type SchedulingProviderId = "calendly" | "calcom" | "manual";

export interface SchedulingLink {
  url: string;
  provider: SchedulingProviderId;
}

export interface SchedulingProvider {
  readonly id: SchedulingProviderId;
  getBookingLink(input: { accountId: string }): Promise<SchedulingLink>;
}
