import { describe, expect, it } from "vitest"

import {
  getCrmProvider,
  MockCrmProvider,
  type CrmProvider,
} from "@/lib/providers/crm"

describe("CrmProvider mock", () => {
  it("resolves to mock when HUBSPOT_ACCESS_TOKEN is absent", () => {
    delete process.env.HUBSPOT_ACCESS_TOKEN
    const provider = getCrmProvider()
    expect(provider).toBeInstanceOf(MockCrmProvider)
    expect(provider.providerId).toBe("mock")
  })

  it("returns deterministic contact and event fixtures", async () => {
    const run = async () => {
      const provider: CrmProvider = new MockCrmProvider()
      const contact = await provider.upsertContact({
        accountId: "org-1",
        externalId: "lead-1",
        email: "lead@example.com",
        phone: "+15550101",
        firstName: "Alex",
        lastName: "Lee",
      })
      const event = await provider.recordEvent({
        accountId: "org-1",
        contactExternalId: "lead-1",
        eventType: "missed_call_recovered",
        payload: { callId: "call-1" },
      })
      return { contact, event }
    }

    const first = await run()
    const second = await run()

    expect(first).toEqual(second)
    expect(first.contact).toMatchObject({
      providerContactId: "mock-crm:org-1:lead-1",
      email: "lead@example.com",
      syncedAt: "2026-01-01T00:00:00.000Z",
    })
    expect(first.event).toMatchObject({
      providerEventId: "mock-event:org-1:lead-1:missed_call_recovered",
      status: "accepted",
      recordedAt: "2026-01-01T00:00:01.000Z",
    })
  })
})
