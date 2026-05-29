import type { Prisma } from "@prisma/client";
import { nextTestId } from "./ids";

export function makeSmsMessage(
  params: { accountId: string; conversationId: string },
  overrides: Partial<Prisma.SmsMessageCreateInput> = {},
): Prisma.SmsMessageCreateInput {
  const id = overrides.id ?? nextTestId("sms");
  const base: Prisma.SmsMessageCreateInput = {
    id,
    account_id: params.accountId,
    conversation_id: params.conversationId,
    provider: "twilio",
    provider_message_id: `SM_test_${id}`,
    direction: "inbound",
    from_number: "+15555550199",
    to_number: "+15555550100",
    body: "Factory SMS message",
    status: "received",
    segment_count: 1,
  };
  return { ...base, ...overrides };
}
