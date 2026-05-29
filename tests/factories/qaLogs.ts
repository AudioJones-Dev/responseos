import type { Prisma } from "@prisma/client";
import { nextTestId } from "./ids";

export function makeQaLog(
  params: { accountId: string; callId: string },
  overrides: Partial<Prisma.QaLogCreateInput> = {},
): Prisma.QaLogCreateInput {
  const id = overrides.id ?? nextTestId("qa");
  const base: Prisma.QaLogCreateInput = {
    id,
    account_id: params.accountId,
    call_id: params.callId,
    rubric_version: "v1",
    reviewer_type: "system",
    score: 80,
    findings_json: { rubric: "factory" },
    reviewed_at: new Date("2026-05-04T16:00:00.000Z"),
  };
  return { ...base, ...overrides };
}
