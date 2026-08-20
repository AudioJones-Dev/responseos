export {
  getMockVirtualExtensionDirectory,
  MOCK_VIRTUAL_EXTENSION_ACCOUNT_IDS,
} from "@/lib/routing/virtualExtensions/mockDirectory"
export { toVirtualExtensionRoutingEvents } from "@/lib/routing/virtualExtensions/events"
export { resolveVirtualExtensionRoute } from "@/lib/routing/virtualExtensions/resolveRoute"
export type {
  VirtualExtensionAvailabilityState,
  VirtualExtensionDefinition,
  VirtualExtensionDestinationType,
  VirtualExtensionRouteDecision,
  VirtualExtensionRouteOutcome,
  VirtualExtensionRouteReasonCode,
  VirtualExtensionRouteRequest,
  VirtualExtensionRouteSource,
  VirtualExtensionRoutingEvent,
  VirtualExtensionRoutingEventType,
} from "@/lib/routing/virtualExtensions/types"
