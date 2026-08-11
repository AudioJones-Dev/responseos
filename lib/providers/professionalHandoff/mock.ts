import type {
  ProfessionalHandoffEvent,
  ProfessionalHandoffProvider,
  ProfessionalHandoffReceipt,
} from "@/lib/providers/professionalHandoff/types"

/**
 * No-op handoff adapter. The event contract exists; no consumer does.
 * Emitting is deliberately silent — no network, no queue, no log — so
 * the receptionist flow runs identically with and without a Career OS
 * deployment.
 */
export class NoopProfessionalHandoffProvider
  implements ProfessionalHandoffProvider
{
  readonly providerId = "noop" as const

  async emit(
    event: ProfessionalHandoffEvent,
  ): Promise<ProfessionalHandoffReceipt> {
    return {
      providerId: this.providerId,
      event: event.name,
      delivered: false,
    }
  }
}
