import { randomUUID } from "node:crypto"
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { prisma, disconnectTestDb, resetAndSeedTestDb } from "./setup"
import * as session from "@/lib/auth/session"
import type { UserRole } from "@/types/user"
const authority: { accountId: string; userId: string; role: UserRole } = { accountId: "org_mock_1", userId: "test-operator", role: "client_admin" }
import { appendFrlInquiryEvent } from "@/lib/frl/persistence"

const intake = (pathway = "residential") => ({
  namespace: "frl.inquiry", schemaVersion: 2, type: "inbound_received", eventId: randomUUID(), inquiryId: randomUUID(),
  expectedRevision: 0, sourceChannel: "form", sourceEventId: randomUUID(), correlationId: randomUUID(),
  occurredAt: "2026-10-07T17:00:00.000Z", data: { pathway, contextReference: "private:context-1" },
})

describe("FRL transactional persistence (no worker)", () => {
  beforeEach(async () => {
    authority.accountId = "org_mock_1"; authority.role = "client_admin"
    vi.spyOn(session, "requireRole").mockImplementation(async roles => {
      if (!(Array.isArray(roles) ? roles : [roles]).includes(authority.role)) throw new Error("role_denied")
      return { user: { id: authority.userId, role: authority.role, name: "Test", email: "test@example.invalid" },
        account: authority.accountId ? { id: authority.accountId, slug: "test", name: "Test" } : null, expires_at: "2099-01-01T00:00:00Z" }
    })
    await resetAndSeedTestDb()
  })
  afterEach(() => vi.restoreAllMocks())
  afterAll(disconnectTestDb)

  it("commits inquiry, immutable event and blocked intent together", async () => {
    const event = intake()
    const receipt = await appendFrlInquiryEvent(event)
    expect(receipt).toMatchObject({ eventId: event.eventId, revision: 1, status: "blocked", duplicate: false })
    expect(await prisma.frlInquiry.findFirstOrThrow()).toMatchObject({ account_id: "org_mock_1", revision: 1 })
    expect(await prisma.frlInquiryEvent.findFirstOrThrow()).toMatchObject({ actor_id: "test-operator", schema_version: 2 })
    expect(await prisma.frlOutboxOperation.findFirstOrThrow()).toMatchObject({ status: "blocked", blocked_reason: "commissioning_not_accepted" })
  })
  it("concurrent exact replay returns one logical event and intent", async () => {
    const event = intake()
    const receipts = await Promise.all(Array.from({ length: 6 }, () => appendFrlInquiryEvent(event)))
    expect(new Set(receipts.map(r => r.operationId)).size).toBe(1)
    expect(receipts.filter(r => !r.duplicate)).toHaveLength(1)
    expect(await prisma.frlInquiryEvent.count()).toBe(1)
    expect(await prisma.frlOutboxOperation.count()).toBe(1)
  })
  it("rejects altered replay and reused source identity", async () => {
    const event = intake()
    await appendFrlInquiryEvent(event)
    await expect(appendFrlInquiryEvent({ ...event, data: { ...event.data, contextReference: "changed" } })).rejects.toThrow("event_conflict")
    await expect(appendFrlInquiryEvent({ ...event, eventId: randomUUID() })).rejects.toThrow("event_conflict")
    expect(await prisma.frlInquiryEvent.count()).toBe(1)
  })
  it("serializes revisions and preserves earlier replay after later events", async () => {
    const event = intake()
    const receipt = await appendFrlInquiryEvent(event)
    const next = { ...event, type: "context_recorded", expectedRevision: 1, data: { contextReference: "private:context-2", evidenceReference: "evidence:2" } }
    const results = await Promise.allSettled([1, 2].map(() => appendFrlInquiryEvent({ ...next, eventId: randomUUID(), sourceEventId: randomUUID() })))
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1)
    expect(results.filter(r => r.status === "rejected")).toHaveLength(1)
    expect(await prisma.frlInquiry.findFirstOrThrow()).toMatchObject({ revision: 2 })
    expect(await appendFrlInquiryEvent(event)).toEqual({ ...receipt, duplicate: true })
  })
  it("separates identical IDs across tenants and rejects cross-tenant foreign keys", async () => {
    const event = intake()
    await appendFrlInquiryEvent(event)
    authority.accountId = "org_responseos_demo"
    await appendFrlInquiryEvent(event)
    expect(await prisma.frlInquiryEvent.count()).toBe(2)
    await expect(prisma.frlOutboxOperation.create({ data: { account_id: "wrong-tenant", operation_id: randomUUID(), event_id: event.eventId, operation_type: "crm_projection_requested", schema_version: 1, status: "blocked", blocked_reason: "commissioning_not_accepted" } })).rejects.toThrow()
  })
  it.each(["equipment_acquisition", "repair", "builder", "architect", "commercial"])("keeps %s blocked through replay", async pathway => {
    const event = intake(pathway)
    await appendFrlInquiryEvent(event)
    await appendFrlInquiryEvent(event)
    expect(await prisma.frlOutboxOperation.findFirstOrThrow()).toMatchObject({ status: "blocked", blocked_reason: pathway === "equipment_acquisition" ? "acquisition_not_authorized" : "commissioning_not_accepted" })
    await expect(prisma.frlOutboxOperation.updateMany({ data: { status: "pending" } })).rejects.toThrow()
  })
  it("rejects missing tenant, viewer authority and unrecognized envelope fields", async () => {
    authority.accountId = ""
    await expect(appendFrlInquiryEvent(intake())).rejects.toThrow("tenant_scope_required")
    authority.accountId = "org_mock_1"; authority.role = "client_viewer"
    await expect(appendFrlInquiryEvent(intake())).rejects.toThrow("role_denied")
    authority.role = "client_admin"
    await expect(appendFrlInquiryEvent({ ...intake(), accountId: "spoof" })).rejects.toThrow("invalid_event")
    expect(await prisma.frlInquiryEvent.count()).toBe(0)
  })
  it("enforces immutable event history in PostgreSQL", async () => {
    await appendFrlInquiryEvent(intake())
    await expect(prisma.frlInquiryEvent.updateMany({ data: { actor_id: "changed" } })).rejects.toThrow()
    await expect(prisma.frlInquiryEvent.deleteMany()).rejects.toThrow()
    expect(await prisma.frlInquiryEvent.count()).toBe(1)
  })
  it.each(["FrlInquiryEvent", "FrlOutboxOperation"])("rolls back all changes when %s insertion fails", async table => {
    await prisma.$executeRawUnsafe(`CREATE FUNCTION frl_test_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic-secret-not-for-logs'; END $$`)
    await prisma.$executeRawUnsafe(`CREATE TRIGGER frl_test_fail BEFORE INSERT ON "${table}" FOR EACH ROW EXECUTE FUNCTION frl_test_fail()`)
    try {
      await expect(appendFrlInquiryEvent(intake())).rejects.toThrow(/^persistence_unavailable$/)
      expect(await prisma.frlInquiry.count()).toBe(0)
      expect(await prisma.frlInquiryEvent.count()).toBe(0)
      expect(await prisma.frlOutboxOperation.count()).toBe(0)
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER frl_test_fail ON "${table}"`)
      await prisma.$executeRawUnsafe(`DROP FUNCTION frl_test_fail()`)
    }
  })
})
