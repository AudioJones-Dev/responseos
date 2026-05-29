import type { Prisma } from "@prisma/client";
import { nextTestId } from "./ids";

export function makeConversation(
  params: { accountId: string; contactId?: string | null },
  overrides: Partial<Prisma.ConversationCreateInput> = {},
): Prisma.ConversationCreateInput {
  const id = overrides.id ?? nextTestId("conv");
  const base: Prisma.ConversationCreateInput = {
    id,
    account_id: params.accountId,
    contact_id: params.contactId ?? null,
    business_number: "+15555550100",
    peer_number: "+15555550199",
    status: "open",
    last_message_at: new Date("2026-05-04T15:45:00.000Z"),
  };
  return { ...base, ...overrides };
}
