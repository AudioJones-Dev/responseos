/** CrmProvider — HubSpot default (mock-only). */

export type CrmProviderId = "hubspot" | "ghl" | "manual";

export interface CrmContactRef {
  externalId: string;
  email?: string;
}

export interface CrmProvider {
  readonly id: CrmProviderId;
  upsertContact(input: {
    email: string;
    name: string;
  }): Promise<CrmContactRef>;
}
