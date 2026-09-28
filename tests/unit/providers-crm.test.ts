import { afterEach, describe, expect, it, vi } from "vitest"

import {
  getCrmProvider,
  MockCrmProvider,
  HubSpotCrmProvider,
  type CrmProvider,
} from "@/lib/providers/crm"

describe("CrmProvider mock", () => {
  it("resolves to mock when HUBSPOT_ACCESS_TOKEN is absent", () => {
    delete process.env.HUBSPOT_ACCESS_TOKEN
    const provider = getCrmProvider()
    expect(provider).toBeInstanceOf(MockCrmProvider)
    expect(provider.providerId).toBe("mock")
  })

  it("does not activate HubSpot from token presence alone", () => {
    process.env.HUBSPOT_ACCESS_TOKEN = "placeholder"
    delete process.env.RESPONSEOS_LIVE_HUBSPOT_ENABLED
    expect(getCrmProvider()).toBeInstanceOf(MockCrmProvider)
  })

  it("activates HubSpot only when the explicit flag and token are both present", () => {
    process.env.HUBSPOT_ACCESS_TOKEN = "placeholder"
    process.env.RESPONSEOS_LIVE_HUBSPOT_ENABLED = "true"
    expect(getCrmProvider()).toBeInstanceOf(HubSpotCrmProvider)
    delete process.env.RESPONSEOS_LIVE_HUBSPOT_ENABLED
    delete process.env.HUBSPOT_ACCESS_TOKEN
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


describe("HubSpot reconciliation semantics", () => {
  afterEach(() => vi.unstubAllGlobals());
  const input = { effect: "activity_create" as const, phone: "+15555550199", evidenceReference: "ResponseOS call c review r hash" };
  function reply(body: unknown) { const fetch = vi.fn().mockImplementation(async () => new Response(JSON.stringify(body), { status: 200 })); vi.stubGlobal("fetch", fetch); return fetch; }
  it("does not hide multiple call or task matches", async () => {
    reply({ total: 2, results: [{ id: "a" }, { id: "b" }] });
    const provider = new HubSpotCrmProvider("fictional-test-token");
    await expect(provider.findCallActivity(input.evidenceReference)).rejects.toThrow("ambiguous_activity_match");
    await expect(provider.findFollowUpTask(input.evidenceReference)).rejects.toThrow("ambiguous_activity_match");
    expect(await provider.reconcileEffect(input)).toEqual({ outcome: "ambiguous", candidateIds: ["a", "b"] });
  });
  it("empty search is not observed and never performs a provider write", async () => {
    const fetch = reply({ total: 0, results: [] });
    expect(await new HubSpotCrmProvider("fictional").reconcileEffect(input)).toEqual({ outcome: "not_observed" });
    expect(fetch).toHaveBeenCalledOnce(); expect(fetch.mock.calls[0][0]).toContain("/search");
  });
  it("adopts only a single exact correlation match", async () => {
    reply({ total: 1, results: [{ id: "a", properties: { hs_call_title: input.evidenceReference } }] });
    expect(await new HubSpotCrmProvider("fictional").reconcileEffect(input)).toEqual({ outcome: "verified_match", providerId: "a" });
    reply({ total: 1, results: [{ id: "a", properties: { hs_call_title: "wrong review" } }] });
    expect((await new HubSpotCrmProvider("fictional").reconcileEffect(input)).outcome).toBe("ambiguous");
  });
  it("does not mistake malformed or failed readback for absence", async () => {
    reply({}); const provider = new HubSpotCrmProvider("fictional");
    expect(await provider.reconcileEffect(input)).toEqual({ outcome: "unavailable" });
    await expect(provider.findCallActivity(input.evidenceReference)).rejects.toThrow("crm_lookup_unavailable");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    expect(await provider.reconcileEffect(input)).toEqual({ outcome: "unavailable" });
  });
  it.each([["activity_associate", 194], ["task_associate", 204]] as const)("%s requires the exact HubSpot-defined relationship", async (effect, typeId) => {
    const association = { ...input, effect, contactId: "123", objectId: "456" };
    reply({ results: [{ toObjectId: 123, associationTypes: [{ category: "HUBSPOT_DEFINED", typeId }] }] });
    expect(await new HubSpotCrmProvider("fictional").reconcileEffect(association)).toEqual({ outcome: "verified_match", providerId: "456" });
    reply({ results: [{ toObjectId: 999, associationTypes: [{ category: "HUBSPOT_DEFINED", typeId }] }] });
    expect((await new HubSpotCrmProvider("fictional").reconcileEffect(association)).outcome).toBe("not_observed");
  });
  it("contact adoption requires exact phone and frozen approved caller name", async () => {
    reply({ total: 1, results: [{ id: "a", properties: { phone: input.phone, firstname: "Other caller" } }] });
    const provider = new HubSpotCrmProvider("fictional");
    expect((await provider.reconcileEffect({ ...input, effect: "contact_create", firstName: "Fictional caller" })).outcome).toBe("ambiguous");
    reply({ total: 1, results: [{ id: "a", properties: { phone: input.phone, firstname: "Fictional caller" } }] });
    expect((await provider.reconcileEffect({ ...input, effect: "contact_create", firstName: "Fictional caller" })).outcome).toBe("verified_match");
  });
  it("binds the real destination to the provider-reported portal", async () => {
    reply({ portalId: 123 }); expect(await new HubSpotCrmProvider("fictional").getDestination()).toBe("hubspot:123");
    reply({}); await expect(new HubSpotCrmProvider("fictional").getDestination()).rejects.toThrow("crm_destination_unavailable");
  });
});
