import "@/lib/serverOnlyGuard";
import {
  claimFrlMockDelivery,
  settleFrlMockDelivery,
  type MockDeliveryKind,
} from "./frlMockDelivery";
import { FrlWebIntakeError } from "./frlWebIntakes";

export async function runFrlMockDelivery(input: {
  reference: string;
  kind: MockDeliveryKind;
  scenario: "confirmed" | "rejected" | "uncertain";
}) {
  if (!["confirmed", "rejected", "uncertain"].includes(input.scenario))
    throw new FrlWebIntakeError("invalid_request");
  const claim = await claimFrlMockDelivery(input.reference, input.kind);
  if (claim.status !== "claimed") return { ...claim, mode: "mock" as const };
  const receiptId =
    input.scenario === "confirmed" ? `mock_${claim.operationId}` : undefined;
  try {
    const settled = await settleFrlMockDelivery({
      operationId: claim.operationId,
      token: claim.token,
      outcome: input.scenario,
      receiptId,
    });
    return {
      ...settled,
      settlementRecorded: true,
      ...(settled.status === "confirmed" ? { receiptId } : {}),
    };
  } catch {
    // The committed claim still fences retries if settlement was lost.
    return {
      status: "uncertain" as const,
      mode: "mock" as const,
      settlementRecorded: false,
    };
  }
}
