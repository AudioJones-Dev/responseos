import { ISODate, UUID } from "./common";

export type ConversationStatus = "open" | "archived" | "blocked" | "spam";

export interface Conversation {
  id: UUID;
  account_id: UUID;
  contact_id?: UUID;
  business_number: string;
  peer_number: string;
  status: ConversationStatus;
  last_message_at: ISODate;
  created_at: ISODate;
  updated_at: ISODate;
}
