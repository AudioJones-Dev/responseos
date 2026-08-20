import { describe, expect, it } from "vitest"

import {
  getMockVirtualExtensionDirectory,
  MOCK_VIRTUAL_EXTENSION_ACCOUNT_IDS,
  resolveVirtualExtensionRoute,
  toVirtualExtensionRoutingEvents,
  type VirtualExtensionRouteRequest,
} from "@/lib/routing/virtualExtensions"

const OCCURRED_AT = "2026-08-20T12:00:00.000Z"

function request(
  overrides: Partial<VirtualExtensionRouteRequest> = {},
): VirtualExtensionRouteRequest {
  return {
    routeRequestId: "route-request-1",
    accountId: MOCK_VIRTUAL_EXTENSION_ACCOUNT_IDS.accountA,
    callId: "call-route-1",
    occurredAt: OCCURRED_AT,
    source: "default",
    ...overrides,
  }
}

describe("virtual extension routing", () => {
  it("resolves DTMF 101 to the synthetic account A sales destination", () => {
    const decision = resolveVirtualExtensionRoute(
      request({ source: "dtmf", requestedExtension: " 101 " }),
    )

    expect(decision).toMatchObject({
      accountId: MOCK_VIRTUAL_EXTENSION_ACCOUNT_IDS.accountA,
      extensionRef: "ext_mock_a_sales",
      policyRef: "policy_mock_a_sales_v1",
      policyVersion: 1,
      destinationRef: "dest_mock_a_sales_human",
      destinationType: "human_pstn",
      availabilityState: "unknown",
      outcome: "resolved",
      reasonCode: "dtmf_exact",
    })
  })

  it("resolves normalized spoken sales intent to the same destination", () => {
    const decision = resolveVirtualExtensionRoute(
      request({ source: "speech", intent: "  SALES   " }),
    )

    expect(decision).toMatchObject({
      extensionRef: "ext_mock_a_sales",
      destinationRef: "dest_mock_a_sales_human",
      outcome: "resolved",
      reasonCode: "speech_alias_exact",
    })
  })

  it("resolves a spoken numeric extension exactly", () => {
    const decision = resolveVirtualExtensionRoute(
      request({ source: "speech", requestedExtension: "101" }),
    )

    expect(decision).toMatchObject({
      extensionRef: "ext_mock_a_sales",
      outcome: "resolved",
      reasonCode: "speech_extension_exact",
    })
  })

  it("gives explicit DTMF precedence over conflicting speech intent", () => {
    const decision = resolveVirtualExtensionRoute(
      request({
        source: "dtmf",
        requestedExtension: "101",
        intent: "operator",
      }),
    )

    expect(decision).toMatchObject({
      extensionRef: "ext_mock_a_sales",
      destinationRef: "dest_mock_a_sales_human",
      outcome: "resolved",
      reasonCode: "dtmf_precedence",
    })
  })

  it("does not fuzzy-match a near alias", () => {
    const decision = resolveVirtualExtensionRoute(
      request({ source: "speech", intent: "sale" }),
    )

    expect(decision).toMatchObject({
      extensionRef: null,
      destinationRef: null,
      outcome: "clarify",
      reasonCode: "unknown_extension",
    })
  })

  it("clarifies an unknown extension once", () => {
    const decision = resolveVirtualExtensionRoute(
      request({
        source: "dtmf",
        requestedExtension: "999",
        clarificationCount: 0,
      }),
    )

    expect(decision).toMatchObject({
      extensionRef: null,
      destinationRef: null,
      outcome: "clarify",
      reasonCode: "unknown_extension",
    })
  })

  it("falls back to message capture after clarification is exhausted", () => {
    const decision = resolveVirtualExtensionRoute(
      request({
        source: "dtmf",
        requestedExtension: "999",
        clarificationCount: 1,
      }),
    )

    expect(decision).toMatchObject({
      extensionRef: "ext_mock_a_operator",
      destinationRef: "dest_mock_a_message_capture",
      destinationType: "message_capture",
      outcome: "fallback",
      reasonCode: "clarification_exhausted",
    })
  })

  it("routes extension 0 and an empty target to message capture", () => {
    const operator = resolveVirtualExtensionRoute(
      request({ source: "dtmf", requestedExtension: "0" }),
    )
    const noTarget = resolveVirtualExtensionRoute(request())

    expect(operator).toMatchObject({
      extensionRef: "ext_mock_a_operator",
      destinationType: "message_capture",
      outcome: "fallback",
      reasonCode: "operator_fallback",
    })
    expect(noTarget).toMatchObject({
      extensionRef: "ext_mock_a_operator",
      destinationType: "message_capture",
      outcome: "fallback",
      reasonCode: "no_target",
    })
  })

  it("keeps identical extension codes isolated by account", () => {
    const accountA = resolveVirtualExtensionRoute(
      request({ source: "dtmf", requestedExtension: "101" }),
    )
    const accountB = resolveVirtualExtensionRoute(
      request({
        accountId: MOCK_VIRTUAL_EXTENSION_ACCOUNT_IDS.accountB,
        source: "dtmf",
        requestedExtension: "101",
      }),
    )
    const accountASupport = resolveVirtualExtensionRoute(
      request({ source: "speech", intent: "support" }),
    )

    expect(accountA.destinationRef).toBe("dest_mock_a_sales_human")
    expect(accountB).toMatchObject({
      extensionRef: "ext_mock_b_support",
      destinationRef: "dest_mock_b_support_human",
    })
    expect(accountASupport).toMatchObject({
      destinationRef: null,
      outcome: "clarify",
      reasonCode: "unknown_extension",
    })
  })

  it("rejects an account that has no configured mock directory", () => {
    const decision = resolveVirtualExtensionRoute(
      request({ accountId: "acct_route_unconfigured", source: "dtmf", requestedExtension: "101" }),
    )

    expect(decision).toMatchObject({
      extensionRef: null,
      policyRef: null,
      destinationRef: null,
      outcome: "rejected",
      reasonCode: "account_not_configured",
    })
  })

  it("returns stable decision and event identities for the same request", () => {
    const routeRequest = request({ source: "speech", intent: "sales" })
    const firstDecision = resolveVirtualExtensionRoute(routeRequest)
    const secondDecision = resolveVirtualExtensionRoute(routeRequest)
    const firstEvents = toVirtualExtensionRoutingEvents(routeRequest, firstDecision)
    const secondEvents = toVirtualExtensionRoutingEvents(routeRequest, secondDecision)
    const differentDecision = resolveVirtualExtensionRoute({
      ...routeRequest,
      routeRequestId: "route-request-2",
    })

    expect(secondDecision).toEqual(firstDecision)
    expect(secondEvents).toEqual(firstEvents)
    expect(differentDecision.decisionId).not.toBe(firstDecision.decisionId)
  })

  it("maps resolved, unresolved, and fallback decisions without transfer claims", () => {
    const resolvedRequest = request({ source: "speech", intent: "sales" })
    const clarifyRequest = request({
      routeRequestId: "route-request-clarify",
      source: "speech",
      intent: "unknown",
    })
    const fallbackRequest = request({
      routeRequestId: "route-request-fallback",
      source: "dtmf",
      requestedExtension: "999",
      clarificationCount: 1,
    })

    const resolvedEvents = toVirtualExtensionRoutingEvents(
      resolvedRequest,
      resolveVirtualExtensionRoute(resolvedRequest),
    )
    const clarifyEvents = toVirtualExtensionRoutingEvents(
      clarifyRequest,
      resolveVirtualExtensionRoute(clarifyRequest),
    )
    const fallbackEvents = toVirtualExtensionRoutingEvents(
      fallbackRequest,
      resolveVirtualExtensionRoute(fallbackRequest),
    )
    const eventTypes = [...resolvedEvents, ...clarifyEvents, ...fallbackEvents].map(
      (routingEvent) => routingEvent.eventType,
    )

    expect(resolvedEvents.map((routingEvent) => routingEvent.eventType)).toEqual([
      "call.route.requested",
      "call.route.resolved",
    ])
    expect(clarifyEvents.map((routingEvent) => routingEvent.eventType)).toEqual([
      "call.route.requested",
      "call.route.unresolved",
    ])
    expect(fallbackEvents.map((routingEvent) => routingEvent.eventType)).toEqual([
      "call.route.requested",
      "call.route.unresolved",
      "call.fallback.selected",
    ])
    expect(eventTypes.some((eventType) => eventType.startsWith("call.transfer."))).toBe(false)
    expect(resolvedEvents[0]).toMatchObject({
      occurredAt: OCCURRED_AT,
      intent: "sales",
      destinationRef: null,
      outcome: null,
      reasonCode: null,
      evidenceRef: "mock-route-request:route-request-1",
    })
    expect(resolvedEvents[1]).toMatchObject({
      destinationRef: "dest_mock_a_sales_human",
      outcome: "resolved",
      reasonCode: "speech_alias_exact",
    })
    expect(fallbackEvents[1]).toMatchObject({
      destinationRef: null,
      outcome: "clarify",
      reasonCode: "clarification_exhausted",
    })
    expect(fallbackEvents[2]).toMatchObject({
      destinationRef: "dest_mock_a_message_capture",
      outcome: "fallback",
      reasonCode: "clarification_exhausted",
    })
  })

  it("contains only synthetic destination references and no live phone numbers", () => {
    const accountA = getMockVirtualExtensionDirectory(
      MOCK_VIRTUAL_EXTENSION_ACCOUNT_IDS.accountA,
    )
    const accountB = getMockVirtualExtensionDirectory(
      MOCK_VIRTUAL_EXTENSION_ACCOUNT_IDS.accountB,
    )
    const serialized = JSON.stringify([accountA, accountB])

    expect(serialized).not.toMatch(/\+\d{7,}/)
    expect(serialized).not.toContain("sip:")
    expect(serialized).not.toContain("tel:")
    expect(serialized).not.toContain("http://")
    expect(serialized).not.toContain("https://")
  })
})
