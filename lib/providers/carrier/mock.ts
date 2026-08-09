import type {
  CarrierCall,
  CarrierCallResult,
  CarrierDialContext,
  CarrierProvider,
} from "@/lib/providers/carrier/types"

const FIXED_STARTED_AT = "2026-01-01T00:00:00.000Z"
const FIXED_ENDED_AT = "2026-01-01T00:00:45.000Z"
const FIXED_DURATION_SECONDS = 45

export class MockCarrierProvider implements CarrierProvider {
  readonly providerId = "mock" as const

  async placeOutboundCall(ctx: CarrierDialContext): Promise<CarrierCall> {
    return {
      providerCallId: `mock-call:${ctx.accountId}:${ctx.callId}`,
      accountId: ctx.accountId,
      callId: ctx.callId,
      to: ctx.to,
      from: ctx.from,
      status: "in_progress",
      startedAt: FIXED_STARTED_AT,
    }
  }

  async hangupCall(call: CarrierCall): Promise<CarrierCallResult> {
    return {
      providerCallId: call.providerCallId,
      accountId: call.accountId,
      callId: call.callId,
      status: "completed",
      endedAt: FIXED_ENDED_AT,
      durationSeconds: FIXED_DURATION_SECONDS,
    }
  }

  async getCallStatus(call: CarrierCall): Promise<CarrierCall["status"]> {
    void call
    return "in_progress"
  }
}
