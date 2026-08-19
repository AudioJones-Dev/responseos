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

export interface CrmContactMatch {
  providerContactId: string
}

export interface CrmContactLookup {
  phone: string
  verifiedEmail?: string
}

export interface CrmContactCreate {
  phone: string
  verifiedEmail?: string
  firstName?: string
  lastName?: string
}

export interface CrmCallActivityCreate {
  contactId: string
  occurredAt: string
  durationSeconds?: number
  sanitizedSummary: string
  qualification: string
  nextAction?: string
  evidenceReference: string
}

export interface CrmFollowUpTaskCreate {
  contactId: string
  dueAt: string
  sanitizedSummary: string
  nextAction: string
  evidenceReference: string
}

export interface CrmProvider {
  readonly providerId: CrmProviderId
  upsertContact(contact: CrmContactUpsert): Promise<CrmContact>
  recordEvent(event: CrmEvent): Promise<CrmEventResult>
  findContacts(lookup: CrmContactLookup): Promise<CrmContactMatch[]>
  createContact(contact: CrmContactCreate): Promise<CrmContactMatch>
  findCallActivity(evidenceReference: string): Promise<{ providerActivityId: string } | null>
  createCallActivity(activity: CrmCallActivityCreate): Promise<{ providerActivityId: string }>
  findFollowUpTask(evidenceReference: string): Promise<{ providerTaskId: string } | null>
  createFollowUpTask(task: CrmFollowUpTaskCreate): Promise<{ providerTaskId: string }>
  associateContact(
    objectType: "calls" | "tasks",
    objectId: string,
    contactId: string,
  ): Promise<void>
}
