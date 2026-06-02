import { z } from "zod";

/**
 * Public marketing inbound — the "request a revenue recovery audit" form on
 * /audit. This is an UNAUTHENTICATED system boundary: prospects have no
 * session and no account, so it is deliberately separate from the
 * tenant-scoped Assessments data layer. The route only acknowledges the
 * request (mock capture) — no provider/CRM write until v0.3.
 */

const trimmedString = (max: number) => z.string().trim().min(1).max(max);

// Optional free text — treat "" / whitespace as "not provided".
const optionalText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(max).optional(),
  );

// Optional numbers — form fields arrive as strings; "" means "not provided".
const dropEmpty = (v: unknown) =>
  v === "" || v === null || v === undefined ? undefined : v;

const optionalCount = z.preprocess(
  dropEmpty,
  z.coerce.number().int().nonnegative().max(1_000_000).optional(),
);

const optionalUsd = z.preprocess(
  dropEmpty,
  z.coerce.number().nonnegative().max(10_000_000).optional(),
);

export const AuditIndustrySchema = z.enum([
  "contractors",
  "home_services",
  "med_spas",
  "other",
]);
export type AuditIndustry = z.infer<typeof AuditIndustrySchema>;

export const AuditRequestSchema = z.object({
  name: trimmedString(120),
  email: z.string().trim().email().max(200),
  business_name: trimmedString(160),
  phone: optionalText(40),
  industry: AuditIndustrySchema.optional(),
  monthly_missed_calls: optionalCount,
  avg_job_value_usd: optionalUsd,
  notes: optionalText(2000),
});
export type AuditRequest = z.infer<typeof AuditRequestSchema>;
