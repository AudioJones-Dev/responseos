import { ISODate, UUID, newId, nowIso } from "./common";

export type CallProvider = "twilio" | "retell" | "vapi" | "bland" | "manual";

export type CallDirection = "inbound" | "outbound";

export type CallStatus =
  | "answered"
  | "missed"
  | "voicemail"
  | "spam"
  | "failed"
  | "completed";

export type CallSentiment = "positive" | "neutral" | "negative";

export interface Call {
  id: UUID;
  account_id: UUID;
  contact_id?: UUID;
  provider: CallProvider;
  provider_call_id?: string;
  direction: CallDirection;
  status: CallStatus;
  from_number: string;
  to_number: string;
  started_at: ISODate;
  ended_at?: ISODate;
  duration_seconds?: number;
  recording_url?: string;
  transcript?: string;
  summary?: string;
  sentiment?: CallSentiment;
  spam_score?: number;
  lead_score?: number;
  created_at: ISODate;
}

export function MockCall(overrides: Partial<Call> = {}): Call {
  const now = nowIso();
  return {
    id: newId(),
    account_id: "org_mock_1",
    contact_id: "contact_mock_1",
    provider: "twilio",
    provider_call_id: "CA" + Math.random().toString(36).slice(2, 12),
    direction: "inbound",
    status: "missed",
    from_number: "+15555550199",
    to_number: "+15555550100",
    started_at: now,
    ended_at: now,
    duration_seconds: 0,
    recording_url: undefined,
    transcript: undefined,
    summary: undefined,
    sentiment: "neutral",
    spam_score: 0.05,
    lead_score: 60,
    created_at: now,
    ...overrides,
  };
}
