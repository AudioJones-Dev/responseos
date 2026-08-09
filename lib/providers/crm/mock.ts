import type {
  CrmContact,
  CrmContactUpsert,
  CrmEvent,
  CrmEventResult,
  CrmProvider,
} from "@/lib/providers/crm/types"

const FIXED_SYNCED_AT = "2026-01-01T00:00:00.000Z"
const FIXED_RECORDED_AT = "2026-01-01T00:00:01.000Z"

export class MockCrmProvider implements CrmProvider {
  readonly providerId = "mock" as const

  async upsertContact(contact: CrmContactUpsert): Promise<CrmContact> {
    return {
      providerContactId: `mock-crm:${contact.accountId}:${contact.externalId}`,
      accountId: contact.accountId,
      externalId: contact.externalId,
      email: contact.email ?? null,
      phone: contact.phone ?? null,
      firstName: contact.firstName ?? null,
      lastName: contact.lastName ?? null,
      syncedAt: FIXED_SYNCED_AT,
    }
  }

  async recordEvent(event: CrmEvent): Promise<CrmEventResult> {
    return {
      providerEventId: `mock-event:${event.accountId}:${event.contactExternalId}:${event.eventType}`,
      accountId: event.accountId,
      status: "accepted",
      recordedAt: FIXED_RECORDED_AT,
    }
  }
}
