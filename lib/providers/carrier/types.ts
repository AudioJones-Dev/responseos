export type CarrierProviderId = "mock" | "telnyx" | "twilio"

export interface CarrierDialContext {
  accountId: string
  callId: string
  to: string
  from: string
}

export interface CarrierCall {
  providerCallId: string
  accountId: string
  callId: string
  to: string
  from: string
  status: "queued" | "ringing" | "in_progress" | "completed"
  startedAt: string
}

export interface CarrierCallResult {
  providerCallId: string
  accountId: string
  callId: string
  status: "completed" | "failed" | "no_answer" | "busy"
  endedAt: string
  durationSeconds: number
}

export interface CarrierProvider {
  readonly providerId: CarrierProviderId
  placeOutboundCall(ctx: CarrierDialContext): Promise<CarrierCall>
  hangupCall(call: CarrierCall): Promise<CarrierCallResult>
  getCallStatus(call: CarrierCall): Promise<CarrierCall["status"]>
}
