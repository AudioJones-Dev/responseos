import { ISODate, UUID } from "./common";

export type TranscriptRetentionLane = "full" | "redacted_only" | "metadata_only";

/**
 * Public shape of a call transcript. `raw_ref` and `redacted_ref` are
 * deliberately NOT part of this type — they are object-storage pointers
 * to PII-bearing artifacts and the accessor that returns them lands
 * after 31D ships `audit_logs.category = "break_glass"` so every
 * elevated read is recorded (see ADR-0019 step 2.3 + planning artifact
 * Q7). `inline_text` is the v0.2 substrate storage path before object
 * storage exists and is accessible through the normal tenant-scoped
 * accessor.
 */
export interface CallTranscript {
  id: UUID;
  account_id: UUID;
  call_id: UUID;
  inline_text?: string;
  language: string;
  retention_lane: TranscriptRetentionLane;
  expires_at?: ISODate;
  redacted_at?: ISODate;
  created_at: ISODate;
}
