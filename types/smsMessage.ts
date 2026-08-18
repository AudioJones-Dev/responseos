import { ISODate, UUID } from "./common";

export type SmsProvider = "telnyx" | "twilio" | "manual";

export type SmsDirection = "inbound" | "outbound";

export type SmsMessageStatus =
  | "queued"
  | "sending"
  | "sent"
  | "delivered"
  | "failed"
  | "received";

export interface SmsMessage {
  id: UUID;
  account_id: UUID;
  conversation_id: UUID;
  provider: SmsProvider;
  provider_message_id?: string;
  direction: SmsDirection;
  from_number: string;
  to_number: string;
  body: string;
  status: SmsMessageStatus;
  segment_count: number;
  error_code?: string;
  error_message?: string;
  sent_at?: ISODate;
  delivered_at?: ISODate;
  created_at: ISODate;
}
