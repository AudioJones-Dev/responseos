export type VirtualExtensionRouteSource = "dtmf" | "speech" | "default"

export type VirtualExtensionDestinationType =
  | "human_pstn"
  | "sip"
  | "voice_agent"
  | "message_capture"

export type VirtualExtensionAvailabilityState =
  | "unknown"
  | "scheduled"
  | "confirmed_available"
  | "confirmed_unavailable"

export type VirtualExtensionRouteOutcome =
  | "resolved"
  | "clarify"
  | "fallback"
  | "rejected"

export type VirtualExtensionRouteReasonCode =
  | "dtmf_exact"
  | "dtmf_precedence"
  | "speech_extension_exact"
  | "speech_alias_exact"
  | "operator_fallback"
  | "unknown_extension"
  | "clarification_exhausted"
  | "no_target"
  | "account_not_configured"

export type VirtualExtensionRoutingEventType =
  | "call.route.requested"
  | "call.route.resolved"
  | "call.route.unresolved"
  | "call.fallback.selected"

export interface VirtualExtensionDefinition {
  readonly accountId: string
  readonly extensionId: string
  readonly code: string
  readonly aliases: readonly string[]
  readonly label: string
  readonly policyRef: string
  readonly policyVersion: number
  readonly destinationRef: string
  readonly destinationType: VirtualExtensionDestinationType
}

export interface VirtualExtensionRouteRequest {
  readonly routeRequestId: string
  readonly accountId: string
  readonly callId: string
  readonly providerCallId?: string
  readonly requestedExtension?: string
  readonly intent?: string
  readonly clarificationCount?: number
  readonly occurredAt: string
  readonly source: VirtualExtensionRouteSource
}

export interface VirtualExtensionRouteDecision {
  readonly decisionId: string
  readonly routeRequestId: string
  readonly accountId: string
  readonly callId: string
  readonly extensionRef: string | null
  readonly policyRef: string | null
  readonly policyVersion: number | null
  readonly destinationRef: string | null
  readonly destinationType: VirtualExtensionDestinationType | null
  readonly availabilityState: VirtualExtensionAvailabilityState
  readonly outcome: VirtualExtensionRouteOutcome
  readonly reasonCode: VirtualExtensionRouteReasonCode
}

export interface VirtualExtensionRoutingEvent {
  readonly eventId: string
  readonly eventType: VirtualExtensionRoutingEventType
  readonly accountId: string
  readonly callId: string
  readonly providerCallId: string | null
  readonly routeRequestId: string
  readonly decisionId: string
  readonly occurredAt: string
  readonly source: VirtualExtensionRouteSource
  readonly requestedExtension: string | null
  readonly intent: string | null
  readonly extensionRef: string | null
  readonly policyRef: string | null
  readonly policyVersion: number | null
  readonly destinationRef: string | null
  readonly destinationType: VirtualExtensionDestinationType | null
  readonly availabilityState: VirtualExtensionAvailabilityState
  readonly outcome: VirtualExtensionRouteOutcome | null
  readonly reasonCode: VirtualExtensionRouteReasonCode | null
  readonly evidenceRef: string
}
