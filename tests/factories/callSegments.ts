import type { Prisma } from "@prisma/client";
import { nextTestId } from "./ids";

export function makeCallSegment(
  params: { accountId: string; callId: string; sequence: number },
  overrides: Partial<Prisma.CallSegmentCreateInput> = {},
): Prisma.CallSegmentCreateInput {
  const id = overrides.id ?? nextTestId("seg");
  const base: Prisma.CallSegmentCreateInput = {
    id,
    account_id: params.accountId,
    call_id: params.callId,
    sequence: params.sequence,
    speaker: "caller",
    text: "Factory segment text",
    confidence: 0.9,
    started_at: new Date("2026-05-04T15:15:00.000Z"),
    ended_at: new Date("2026-05-04T15:15:05.000Z"),
  };
  return { ...base, ...overrides };
}
