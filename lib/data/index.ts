/**
 * Public surface for the v0.2 data-access layer per
 * docs/v0.2-implementation-spec.md §4.
 *
 * Server-only. Every accessor returns a `Result<T>` envelope and enforces
 * tenant scoping via lib/auth/session.ts.
 */

export type { Result } from "./result";
export { ok, err, errFromThrown } from "./result";

export * as Accounts from "./accounts";
export * as Users from "./users";
export * as Contacts from "./contacts";
export * as Calls from "./calls";
export * as Leads from "./leads";
export * as LeadQualifications from "./leadQualifications";
export * as Appointments from "./appointments";
export * as Quotes from "./quotes";
export * as Automations from "./automations";
export * as Notifications from "./notifications";
export * as RevenueMetrics from "./revenueMetrics";
export * as Assessments from "./assessments";
export * as Engagements from "./engagements";
export * as AuditLogs from "./auditLogs";
export * as WebhookEvents from "./webhookEvents";
export * as ProviderConnections from "./providerConnections";
export * as Conversations from "./conversations";
export * as SmsMessages from "./smsMessages";
