import { ISODate, UUID } from "./common";

export type ProviderConnectionProvider =
  | "telnyx"
  | "twilio"
  | "grok"
  | "openai"
  | "retell"
  | "vapi"
  | "bland"
  | "hubspot"
  | "calendly"
  | "google_calendar"
  | "calcom"
  | "stripe";

export type ProviderConnectionStatus =
  | "connected"
  | "disconnected"
  | "error"
  | "expired";

/**
 * Public shape of a provider connection. `credentials_encrypted` and
 * `oauth_refresh_token_encrypted` are intentionally NOT part of this type —
 * the data accessor never returns ciphertext to API consumers; decryption
 * happens at the provider-adapter boundary per ADR-0020.
 */
export interface ProviderConnection {
  id: UUID;
  account_id: UUID;
  provider: ProviderConnectionProvider;
  status: ProviderConnectionStatus;
  scopes: string[];
  connected_by: UUID;
  last_verified_at?: ISODate;
  created_at: ISODate;
  updated_at: ISODate;
}
