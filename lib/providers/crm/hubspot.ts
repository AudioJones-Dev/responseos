import type {
  CrmCallActivityCreate,
  CrmContact,
  CrmContactCreate,
  CrmContactLookup,
  CrmContactMatch,
  CrmContactUpsert,
  CrmEvent,
  CrmEventResult,
  CrmFollowUpTaskCreate,
  CrmProvider,
} from "@/lib/providers/crm/types"

interface HubSpotObject {
  id: string
}

interface HubSpotSearchResponse {
  total?: number
  results?: HubSpotObject[]
}

export class HubSpotCrmProvider implements CrmProvider {
  readonly providerId = "hubspot" as const
  private readonly baseUrl = "https://api.hubapi.com"

  constructor(private readonly token: string) {}

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(8_000),
      headers: {
        authorization: `Bearer ${this.token}`,
        "content-type": "application/json",
        ...init.headers,
      },
    })
    if (!response.ok) throw new Error(`hubspot_http_${response.status}`)
    if (response.status === 204) return undefined as T
    return (await response.json()) as T
  }

  private async search(propertyName: "phone" | "email", value: string) {
    const response = await this.request<HubSpotSearchResponse>(
      "/crm/v3/objects/contacts/search",
      {
        method: "POST",
        body: JSON.stringify({
          filterGroups: [
            {
              filters: [
                { propertyName, operator: "EQ", value },
              ],
            },
          ],
          properties: ["phone", "email"],
          limit: 3,
        }),
      },
    )
    return response.results ?? []
  }

  async findContacts(lookup: CrmContactLookup): Promise<CrmContactMatch[]> {
    const phoneMatches = await this.search("phone", lookup.phone)
    if (phoneMatches.length > 0 || !lookup.verifiedEmail) {
      return phoneMatches.map(({ id }) => ({ providerContactId: id }))
    }
    const emailMatches = await this.search("email", lookup.verifiedEmail)
    return emailMatches.map(({ id }) => ({ providerContactId: id }))
  }

  async createContact(contact: CrmContactCreate): Promise<CrmContactMatch> {
    const properties: Record<string, string> = { phone: contact.phone }
    if (contact.verifiedEmail) properties.email = contact.verifiedEmail
    if (contact.firstName) properties.firstname = contact.firstName
    if (contact.lastName) properties.lastname = contact.lastName
    const created = await this.request<HubSpotObject>("/crm/v3/objects/contacts", {
      method: "POST",
      body: JSON.stringify({ properties }),
    })
    return { providerContactId: created.id }
  }

  private async findActivity(
    objectType: "calls" | "tasks",
    propertyName: "hs_call_title" | "hs_task_subject",
    evidenceReference: string,
  ): Promise<string | null> {
    const response = await this.request<HubSpotSearchResponse>(
      `/crm/v3/objects/${objectType}/search`,
      {
        method: "POST",
        body: JSON.stringify({
          filterGroups: [{ filters: [{ propertyName, operator: "EQ", value: evidenceReference }] }],
          properties: [propertyName],
          limit: 2,
        }),
      },
    )
    return response.results?.[0]?.id ?? null
  }

  async findCallActivity(evidenceReference: string) {
    const id = await this.findActivity("calls", "hs_call_title", evidenceReference)
    return id ? { providerActivityId: id } : null
  }

  async findFollowUpTask(evidenceReference: string) {
    const id = await this.findActivity("tasks", "hs_task_subject", evidenceReference)
    return id ? { providerTaskId: id } : null
  }

  async associateContact(
    objectType: "calls" | "tasks",
    objectId: string,
    contactId: string,
  ) {
    await this.request<void>(
      `/crm/v4/objects/${objectType}/${objectId}/associations/default/contacts/${contactId}`,
      { method: "PUT" },
    )
  }

  async createCallActivity(activity: CrmCallActivityCreate) {
    const body = [
      activity.sanitizedSummary,
      `Qualification: ${activity.qualification}`,
      activity.nextAction ? `Next action: ${activity.nextAction}` : null,
      `ResponseOS evidence: ${activity.evidenceReference}`,
    ].filter(Boolean).join("\n")
    const created = await this.request<HubSpotObject>("/crm/v3/objects/calls", {
      method: "POST",
      body: JSON.stringify({
        properties: {
          hs_timestamp: activity.occurredAt,
          hs_call_title: activity.evidenceReference,
          hs_call_body: body,
          hs_call_status: "COMPLETED",
          hs_call_direction: "INBOUND",
          ...(activity.durationSeconds !== undefined
            ? { hs_call_duration: String(activity.durationSeconds * 1000) }
            : {}),
        },
      }),
    })
    return { providerActivityId: created.id }
  }

  async createFollowUpTask(task: CrmFollowUpTaskCreate) {
    const created = await this.request<HubSpotObject>("/crm/v3/objects/tasks", {
      method: "POST",
      body: JSON.stringify({
        properties: {
          hs_timestamp: task.dueAt,
          hs_task_subject: task.evidenceReference,
          hs_task_body: [
            task.sanitizedSummary,
            `Next action: ${task.nextAction}`,
            `ResponseOS evidence: ${task.evidenceReference}`,
          ].join("\n"),
          hs_task_status: "NOT_STARTED",
          hs_task_priority: "HIGH",
        },
      }),
    })
    return { providerTaskId: created.id }
  }

  async upsertContact(contact: CrmContactUpsert): Promise<CrmContact> {
    const matches = await this.findContacts({
      phone: contact.phone ?? "",
      verifiedEmail: contact.email,
    })
    const resolved = matches[0] ?? await this.createContact({
      phone: contact.phone ?? "",
      verifiedEmail: contact.email,
      firstName: contact.firstName,
      lastName: contact.lastName,
    })
    return {
      providerContactId: resolved.providerContactId,
      accountId: contact.accountId,
      externalId: contact.externalId,
      email: contact.email ?? null,
      phone: contact.phone ?? null,
      firstName: contact.firstName ?? null,
      lastName: contact.lastName ?? null,
      syncedAt: new Date().toISOString(),
    }
  }

  async recordEvent(event: CrmEvent): Promise<CrmEventResult> {
    return {
      providerEventId: `hubspot:${event.accountId}:${event.contactExternalId}:${event.eventType}`,
      accountId: event.accountId,
      status: "accepted",
      recordedAt: new Date().toISOString(),
    }
  }
}
