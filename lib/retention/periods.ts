export const DEMO_CALL_RETENTION_DAYS = 90;
export const CLERK_PAYLOAD_RETENTION_DAYS = 30;
export const RETENTION_AUDIT_DAYS = 365;
export const PURGED_CALLER_NUMBER = "<PURGED>";

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysAfter(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}
