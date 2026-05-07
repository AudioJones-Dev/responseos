import { z } from "zod";

/**
 * Shared zod primitives per docs/v0.2-implementation-spec.md §6.
 */

// Prisma cuids match /^c[a-z0-9]{24}$/ today, but the seed and lib/mock/*
// fixtures use semantic ids like "org_mock_1" and "lead_test_001". Accept both.
export const idSchema = z
  .string()
  .min(1, "id must be a non-empty string")
  .max(80, "id must be at most 80 chars");

export const isoDateSchema = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), "must be a valid ISO date string");

// E.164 phone: leading +, then 1-15 digits.
export const e164PhoneSchema = z
  .string()
  .regex(/^\+[1-9]\d{1,14}$/, "must be a valid E.164 phone number");

export const centsSchema = z
  .number()
  .int("cents must be an integer")
  .nonnegative("cents must be >= 0");

export const organizationIdSchema = idSchema;

export const cursorSchema = z.string().min(1).optional();
export const limitSchema = z.number().int().min(1).max(200).optional();

export const paginationSchema = z.object({
  cursor: cursorSchema,
  limit: limitSchema,
});
