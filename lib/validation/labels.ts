import { z } from "zod";

/**
 * Brand-language enums per docs/v0.2-implementation-spec.md §6 +
 * DESIGN.md §11 (UX writing rules).
 *
 * These are the canonical labels surfaced to operators and clients in the
 * UI. They are NOT 1:1 with the internal Prisma enums — the data accessors
 * map between internal and label values at the boundary.
 */

export const LeadStatusLabel = z.enum([
  "Recovered",
  "Booked",
  "In Progress",
  "Needs Review",
  "Escalated",
  "Archived",
]);
export type LeadStatusLabel = z.infer<typeof LeadStatusLabel>;

/**
 * Maps internal LeadEventStatus enum (from prisma/schema.prisma) to the
 * canonical user-facing label. Used by lib/data/leads.ts at read time.
 */
export const internalLeadStatusToLabel: Record<string, LeadStatusLabel> = {
  new: "In Progress",
  qualified: "In Progress",
  unqualified: "Archived",
  booked: "Booked",
  quoted: "In Progress",
  won: "Recovered",
  lost: "Archived",
  archived: "Archived",
};
