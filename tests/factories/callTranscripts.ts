import type { Prisma } from "@prisma/client";
import { nextTestId } from "./ids";

export function makeCallTranscript(
  params: { accountId: string; callId: string },
  overrides: Partial<Prisma.CallTranscriptCreateInput> = {},
): Prisma.CallTranscriptCreateInput {
  const id = overrides.id ?? nextTestId("xcr");
  const base: Prisma.CallTranscriptCreateInput = {
    id,
    account_id: params.accountId,
    call_id: params.callId,
    inline_text: "Factory transcript inline text",
    language: "en",
    retention_lane: "full",
  };
  return { ...base, ...overrides };
}
