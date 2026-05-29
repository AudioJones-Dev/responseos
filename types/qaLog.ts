import { ISODate, UUID } from "./common";

export type QaReviewerType = "human" | "system" | "automated_llm";

export interface QaLog {
  id: UUID;
  account_id: UUID;
  call_id: UUID;
  rubric_version: string;
  reviewer_type: QaReviewerType;
  reviewer_user_id?: UUID;
  score?: number;
  findings_json: unknown;
  notes?: string;
  reviewed_at: ISODate;
  created_at: ISODate;
}
