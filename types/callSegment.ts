import { ISODate, UUID } from "./common";

export type CallSegmentSpeaker = "caller" | "agent" | "system";

export interface CallSegment {
  id: UUID;
  account_id: UUID;
  call_id: UUID;
  sequence: number;
  speaker: CallSegmentSpeaker;
  text: string;
  redacted_text?: string;
  confidence?: number;
  started_at: ISODate;
  ended_at: ISODate;
  created_at: ISODate;
}
