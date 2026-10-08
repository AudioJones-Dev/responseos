import "@/lib/serverOnlyGuard"
import { createHash } from "node:crypto"
import { z } from "zod"

const reference = z.string().min(1).max(120).regex(/^[a-zA-Z0-9_.:-]+$/)
const base = {
  namespace: z.literal("frl.inquiry"), schemaVersion: z.literal(2),
  eventId: z.uuid(), inquiryId: z.uuid(), expectedRevision: z.number().int().min(0).max(2147483646),
  sourceChannel: z.enum(["form", "call", "email"]), sourceEventId: reference,
  correlationId: reference, occurredAt: z.iso.datetime().transform(v => new Date(v).toISOString()),
}

export const frlEventSchema = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("inbound_received"), data: z.object({
    pathway: z.enum(["residential", "builder", "architect", "commercial", "repair", "equipment_acquisition"]),
    contextReference: reference,
  }).strict() }).strict(),
  z.object({ ...base, type: z.literal("context_recorded"), data: z.object({
    contextReference: reference, evidenceReference: reference,
  }).strict() }).strict(),
])
export type FrlEvent = z.infer<typeof frlEventSchema>

export function frlEventHash(event: FrlEvent, actorId: string): string {
  // Parsed schemas establish key order; callers cannot alter identity via JSON key ordering.
  return createHash("sha256").update(JSON.stringify({ event: frlEventSchema.parse(event), actorId })).digest("hex")
}
