import { describe, expect, it } from "vitest"
import { frlEventHash, frlEventSchema } from "@/lib/frl/events"

const event = {
  namespace: "frl.inquiry", schemaVersion: 2, type: "inbound_received",
  eventId: "00000000-0000-4000-8000-000000000001", inquiryId: "00000000-0000-4000-8000-000000000002",
  expectedRevision: 0, sourceChannel: "form", sourceEventId: "form-1", correlationId: "correlation-1",
  occurredAt: "2026-10-07T17:00:00Z", data: { pathway: "repair", contextReference: "private:context-1" },
}

describe("versioned FRL event boundary", () => {
  it.each([{ schemaVersion: 1 }, { type: "offer_accepted" }, { accountId: "another-tenant" }, { actorId: "spoof" }, { expectedRevision: -1 }, { schemaVersion: 3 }])("rejects unsupported or authority-bearing input %j", change => {
    expect(frlEventSchema.safeParse({ ...event, ...change }).success).toBe(false)
  })
  it("accepts opaque references, not embedded customer payloads", () => {
    expect(frlEventSchema.safeParse({ ...event, data: { pathway: "repair", contextReference: "https://example.invalid/private?token=secret" } }).success).toBe(false)
    expect(frlEventSchema.safeParse({ ...event, data: { ...event.data, email: "customer@example.invalid" } }).success).toBe(false)
  })
  it("hashes semantic key order and equivalent timestamps consistently", () => {
    const parsed = frlEventSchema.parse(event)
    const reordered = frlEventSchema.parse({ ...Object.fromEntries(Object.entries(event).reverse()), occurredAt: "2026-10-07T17:00:00.000Z" })
    expect(frlEventHash(parsed, "actor-1")).toBe(frlEventHash(reordered, "actor-1"))
    expect(frlEventHash(parsed, "actor-2")).not.toBe(frlEventHash(parsed, "actor-1"))
  })
})
