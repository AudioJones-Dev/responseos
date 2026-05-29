import { ISODate, UUID, newId, nowIso } from "./common";

export type NotificationChannel = "sms" | "email" | "in_app" | "slack";

export type NotificationStatus = "queued" | "sent" | "failed";

export interface Notification {
  id: UUID;
  account_id: UUID;
  lead_event_id?: UUID;
  channel: NotificationChannel;
  recipient: string;
  subject?: string;
  message: string;
  status: NotificationStatus;
  sent_at?: ISODate;
  created_at: ISODate;
}

export function MockNotification(
  overrides: Partial<Notification> = {},
): Notification {
  return {
    id: newId(),
    account_id: "org_mock_1",
    lead_event_id: "lead_mock_1",
    channel: "sms",
    recipient: "+15555550199",
    subject: undefined,
    message: "Hi! We just missed your call. Reply with the best time to call you back.",
    status: "queued",
    sent_at: undefined,
    created_at: nowIso(),
    ...overrides,
  };
}
