export type CrmProviderId = "mock" | "hubspot"

export interface CrmContactUpsert {
  accountId: string
  externalId: string
  email?: string
  phone?: string
  firstName?: string
  lastName?: string
}

export interface CrmContact {
  providerContactId: string
  accountId: string
  externalId: string
  email: string | null
  phone: string | null
  firstName: string | null
  lastName: string | null
  syncedAt: string
}

export interface CrmEvent {
  accountId: string
  contactExternalId: string
  eventType: string
  payload: Record<string, string>
}

export interface CrmEventResult {
  providerEventId: string
  accountId: string
  status: "accepted" | "rejected"
  recordedAt: string
}

export interface CrmProvider {
  readonly providerId: CrmProviderId
  upsertContact(contact: CrmContactUpsert): Promise<CrmContact>
  recordEvent(event: CrmEvent): Promise<CrmEventResult>
}
