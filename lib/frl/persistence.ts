import "@/lib/serverOnlyGuard"
import { randomUUID } from "node:crypto"
import { Prisma } from "@prisma/client"
import { requireRole } from "@/lib/auth/session"
import { db } from "@/lib/db/client"
import { frlEventHash, frlEventSchema } from "@/lib/frl/events"

export class FrlPersistenceError extends Error {
  constructor(readonly code: "invalid_event" | "tenant_scope_required" | "no_database" | "event_conflict" | "revision_conflict" | "invalid_transition" | "persistence_unavailable") {
    super(code)
    this.name = "FrlPersistenceError"
  }
}

export async function appendFrlInquiryEvent(raw: unknown) {
  const session = await requireRole(["aj_admin", "operator", "client_admin"])
  if (!session.account?.id) throw new FrlPersistenceError("tenant_scope_required")
  const parsed = frlEventSchema.safeParse(raw)
  if (!parsed.success) throw new FrlPersistenceError("invalid_event")
  if (!db) throw new FrlPersistenceError("no_database")
  const event = parsed.data
  const accountId = session.account.id
  const actorId = session.user.id
  const hash = frlEventHash(event, actorId)
  try {
    return await db.$transaction(async tx => {
      // Serializes duplicate source IDs as well as inquiry revisions, including first insert.
      await tx.$queryRaw`SELECT id FROM "Account" WHERE id = ${accountId} FOR UPDATE`
      const existing = await tx.frlInquiryEvent.findFirst({ where: { account_id: accountId, OR: [
        { event_id: event.eventId },
        { source_channel: event.sourceChannel, source_event_id: event.sourceEventId, event_type: event.type },
      ] }, include: { outbox: true } })
      if (existing) {
        if (existing.content_hash !== hash) throw new FrlPersistenceError("event_conflict")
        return { eventId: existing.event_id, revision: existing.revision, operationId: existing.outbox[0].operation_id, status: "blocked" as const, duplicate: true }
      }
      const key = { account_id_inquiry_id: { account_id: accountId, inquiry_id: event.inquiryId } }
      const current = await tx.frlInquiry.findUnique({ where: key })
      if ((current?.revision ?? 0) !== event.expectedRevision) throw new FrlPersistenceError("revision_conflict")
      if ((!current && event.type !== "inbound_received") || (current && event.type === "inbound_received")) throw new FrlPersistenceError("invalid_transition")
      const revision = event.expectedRevision + 1
      const pathway = event.type === "inbound_received" ? event.data.pathway : current!.pathway
      if (current) {
        await tx.frlInquiry.update({ where: key, data: { revision } })
      } else {
        await tx.frlInquiry.create({ data: { account_id: accountId, inquiry_id: event.inquiryId, pathway, revision } })
      }
      await tx.frlInquiryEvent.create({ data: {
        account_id: accountId, event_id: event.eventId, inquiry_id: event.inquiryId,
        schema_version: event.schemaVersion, event_type: event.type, revision,
        source_channel: event.sourceChannel, source_event_id: event.sourceEventId,
        correlation_id: event.correlationId, actor_id: actorId, content_hash: hash,
        envelope: event, occurred_at: new Date(event.occurredAt),
      } })
      const operation = await tx.frlOutboxOperation.create({ data: {
        account_id: accountId, operation_id: randomUUID(), event_id: event.eventId,
        schema_version: 1, operation_type: "crm_projection_requested", status: "blocked",
        blocked_reason: pathway === "equipment_acquisition" ? "acquisition_not_authorized" : "commissioning_not_accepted",
      } })
      return { eventId: event.eventId, revision, operationId: operation.operation_id, status: "blocked" as const, duplicate: false }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted })
  } catch (error) {
    if (error instanceof FrlPersistenceError) throw error
    // SQL/Prisma errors can contain bind parameters or customer content.
    throw new FrlPersistenceError("persistence_unavailable")
  }
}
