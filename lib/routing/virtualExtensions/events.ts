import { createHash } from "node:crypto"

import type {
  VirtualExtensionRouteDecision,
  VirtualExtensionRouteRequest,
  VirtualExtensionRoutingEvent,
  VirtualExtensionRoutingEventType,
} from "@/lib/routing/virtualExtensions/types"

function eventIdFor(
  decisionId: string,
  eventType: VirtualExtensionRoutingEventType,
  ordinal: number,
): string {
  const digest = createHash("sha256")
    .update(JSON.stringify([decisionId, eventType, ordinal]))
    .digest("hex")
    .slice(0, 24)
  return `route-event-mock-${digest}`
}

function event(
  request: VirtualExtensionRouteRequest,
  decision: VirtualExtensionRouteDecision,
  eventType: VirtualExtensionRoutingEventType,
  ordinal: number,
): VirtualExtensionRoutingEvent {
  const requested = eventType === "call.route.requested"
  const unresolved = eventType === "call.route.unresolved"
  return {
    eventId: eventIdFor(decision.decisionId, eventType, ordinal),
    eventType,
    accountId: request.accountId,
    callId: request.callId,
    providerCallId: request.providerCallId ?? null,
    routeRequestId: request.routeRequestId,
    decisionId: decision.decisionId,
    occurredAt: request.occurredAt,
    source: request.source,
    requestedExtension: request.requestedExtension?.trim() || null,
    intent: request.intent?.trim().toLowerCase().replace(/\s+/g, " ") || null,
    extensionRef: requested || unresolved ? null : decision.extensionRef,
    policyRef: requested || unresolved ? null : decision.policyRef,
    policyVersion: requested || unresolved ? null : decision.policyVersion,
    destinationRef: requested || unresolved ? null : decision.destinationRef,
    destinationType: requested || unresolved ? null : decision.destinationType,
    availabilityState: decision.availabilityState,
    outcome: requested
      ? null
      : unresolved
        ? decision.outcome === "rejected"
          ? "rejected"
          : "clarify"
        : decision.outcome,
    reasonCode: requested ? null : decision.reasonCode,
    evidenceRef: `mock-route-request:${request.routeRequestId}`,
  }
}

export function toVirtualExtensionRoutingEvents(
  request: VirtualExtensionRouteRequest,
  decision: VirtualExtensionRouteDecision,
): readonly VirtualExtensionRoutingEvent[] {
  const eventTypes: VirtualExtensionRoutingEventType[] = ["call.route.requested"]

  if (decision.outcome === "resolved") {
    eventTypes.push("call.route.resolved")
  } else if (decision.outcome === "clarify" || decision.outcome === "rejected") {
    eventTypes.push("call.route.unresolved")
  } else {
    if (decision.reasonCode === "clarification_exhausted") {
      eventTypes.push("call.route.unresolved")
    }
    eventTypes.push("call.fallback.selected")
  }

  return eventTypes.map((eventType, ordinal) => event(request, decision, eventType, ordinal))
}
