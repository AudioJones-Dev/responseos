import { describe, expect, it } from "vitest"

import {
  DEFAULT_TELNYX_HUBSPOT_SYNC_POLICY,
  getCrmProvider,
  MOCK_TELNYX_HUBSPOT_SYNC_REQUEST,
  MOCK_TELNYX_HUBSPOT_SYNC_RESULT,
  MockCrmProvider,
  type CrmProvider,
  type CrmSyncPolicy,
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

describe("Telnyx-to-HubSpot H0 contract", () => {
  it("locks the approved contact matching and field ownership policy", () => {
    expect(DEFAULT_TELNYX_HUBSPOT_SYNC_POLICY).toEqual({
      version: "telnyx-hubspot-h0-v1",
      contactMatchOrder: ["e164_phone", "verified_email"],
      ambiguousContactAction: "review_required",
      existingFieldWriteMode: "fill_empty_only",
      transcriptExport: "sanitized_summary_only",
      recordingExport: "disabled",
      noteCreation: "disabled",
      dealCreation: "disabled",
      ownerAssignment: "preserve",
    })
  })

  it("expresses gated note and deal creation without enabling the defaults", () => {
    const gatedPolicy: CrmSyncPolicy = {
      ...DEFAULT_TELNYX_HUBSPOT_SYNC_POLICY,
      noteCreation: "enabled",
      dealCreation: "qualified_or_appointment",
    }

    expect(gatedPolicy).toMatchObject({
      noteCreation: "enabled",
      dealCreation: "qualified_or_appointment",
    })
    expect(DEFAULT_TELNYX_HUBSPOT_SYNC_POLICY).toMatchObject({
      noteCreation: "disabled",
      dealCreation: "disabled",
    })
  })

  it("provides a deterministic minimum-data sync request fixture", () => {
    expect(MOCK_TELNYX_HUBSPOT_SYNC_REQUEST).toMatchObject({
      accountId: "org_mock_1",
      callId: "call_mock_h0_1",
      sourceEventId: "webhook_mock_h0_1",
      operationKey: "hubspot:org_mock_1:call_mock_h0_1:call-v1",
      policyVersion: DEFAULT_TELNYX_HUBSPOT_SYNC_POLICY.version,
      contactCandidate: {
        phoneE164: "+15550102020",
        verifiedEmail: "prospect@example.com",
      },
      requestedOperations: {
        contact: "upsert",
        call: "create",
        note: "skip",
        deal: "skip",
      },
    })
    expect(MOCK_TELNYX_HUBSPOT_SYNC_REQUEST.callActivity).toEqual({
      startedAt: "2026-01-01T00:00:00.000Z",
      direction: "inbound",
      status: "completed",
      durationSeconds: 45,
      fromE164: "+15550102020",
      toE164: "+15550101010",
      sanitizedSummary: "Caller requested a service assessment and a callback.",
      intent: "service_assessment",
      qualificationFacts: ["Service location provided"],
      nextAction: "Operator callback",
    })
    expect(JSON.stringify(MOCK_TELNYX_HUBSPOT_SYNC_REQUEST)).not.toMatch(
      /rawTranscript|recordingUrl|dealAmount|recoveredRevenue/,
    )
  })

  it("provides a deterministic replay-safe sync result fixture", () => {
    expect(MOCK_TELNYX_HUBSPOT_SYNC_RESULT).toEqual({
      status: "succeeded",
      providerId: "mock",
      accountId: "org_mock_1",
      callId: "call_mock_h0_1",
      sourceEventId: "webhook_mock_h0_1",
      operationKey: "hubspot:org_mock_1:call_mock_h0_1:call-v1",
      policyVersion: "telnyx-hubspot-h0-v1",
      contactResolution: "created",
      providerObjects: {
        contactId: "mock-contact:org_mock_1:call_mock_h0_1",
        callId: "mock-call:org_mock_1:call_mock_h0_1",
      },
      attemptCount: 1,
      providerResponseCategory: "mock_success",
      completedAt: "2026-01-01T00:00:46.000Z",
      evidenceRef: "webhook_mock_h0_1",
    })
    expect(
      Date.parse(MOCK_TELNYX_HUBSPOT_SYNC_RESULT.completedAt),
    ).toBeGreaterThanOrEqual(
      Date.parse(MOCK_TELNYX_HUBSPOT_SYNC_REQUEST.occurredAt),
    )
  })
})
