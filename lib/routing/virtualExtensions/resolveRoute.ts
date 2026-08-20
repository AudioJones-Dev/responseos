import { createHash } from "node:crypto"

import { getMockVirtualExtensionDirectory } from "@/lib/routing/virtualExtensions/mockDirectory"
import type {
  VirtualExtensionDefinition,
  VirtualExtensionRouteDecision,
  VirtualExtensionRouteReasonCode,
  VirtualExtensionRouteRequest,
} from "@/lib/routing/virtualExtensions/types"

function normalizeExtension(value: string | undefined): string | null {
  const normalized = value?.trim()
  return normalized || null
}

function normalizeAlias(value: string | undefined): string | null {
  const normalized = value?.trim().toLowerCase().replace(/\s+/g, " ")
  return normalized || null
}

function decisionIdFor(request: VirtualExtensionRouteRequest): string {
  const digest = createHash("sha256")
    .update(JSON.stringify([request.accountId, request.callId, request.routeRequestId]))
    .digest("hex")
    .slice(0, 24)
  return `route-decision-mock-${digest}`
}

function decision(
  request: VirtualExtensionRouteRequest,
  outcome: VirtualExtensionRouteDecision["outcome"],
  reasonCode: VirtualExtensionRouteReasonCode,
  extension: VirtualExtensionDefinition | null,
): VirtualExtensionRouteDecision {
  return {
    decisionId: decisionIdFor(request),
    routeRequestId: request.routeRequestId,
    accountId: request.accountId,
    callId: request.callId,
    extensionRef: extension?.extensionId ?? null,
    policyRef: extension?.policyRef ?? null,
    policyVersion: extension?.policyVersion ?? null,
    destinationRef: extension?.destinationRef ?? null,
    destinationType: extension?.destinationType ?? null,
    availabilityState: "unknown",
    outcome,
    reasonCode,
  }
}

function fallbackDecision(
  request: VirtualExtensionRouteRequest,
  directory: readonly VirtualExtensionDefinition[],
  reasonCode: VirtualExtensionRouteReasonCode,
): VirtualExtensionRouteDecision {
  const fallback = directory.find((entry) => entry.code === "0")!
  return decision(request, "fallback", reasonCode, fallback)
}

function unresolvedDecision(
  request: VirtualExtensionRouteRequest,
  directory: readonly VirtualExtensionDefinition[],
): VirtualExtensionRouteDecision {
  if ((request.clarificationCount ?? 0) >= 1) {
    return fallbackDecision(request, directory, "clarification_exhausted")
  }
  return decision(request, "clarify", "unknown_extension", null)
}

export function resolveVirtualExtensionRoute(
  request: VirtualExtensionRouteRequest,
): VirtualExtensionRouteDecision {
  const directory = getMockVirtualExtensionDirectory(request.accountId)
  if (!directory) {
    return decision(request, "rejected", "account_not_configured", null)
  }

  const requestedExtension = normalizeExtension(request.requestedExtension)
  const intent = normalizeAlias(request.intent)

  if (request.source === "dtmf" && requestedExtension) {
    const extension = directory.find((entry) => entry.code === requestedExtension)
    if (!extension) return unresolvedDecision(request, directory)
    if (extension.code === "0") {
      return fallbackDecision(request, directory, "operator_fallback")
    }
    const intentExtension = intent
      ? directory.find((entry) => entry.aliases.includes(intent))
      : undefined
    const reasonCode =
      intentExtension && intentExtension.extensionId !== extension.extensionId
        ? "dtmf_precedence"
        : "dtmf_exact"
    return decision(request, "resolved", reasonCode, extension)
  }

  const extensionByCode = requestedExtension
    ? directory.find((entry) => entry.code === requestedExtension)
    : undefined
  const extensionByAlias = intent
    ? directory.find((entry) => entry.aliases.includes(intent))
    : undefined
  const extension = extensionByCode ?? extensionByAlias

  if (extension) {
    if (extension.code === "0") {
      return fallbackDecision(request, directory, "operator_fallback")
    }
    return decision(
      request,
      "resolved",
      extensionByCode ? "speech_extension_exact" : "speech_alias_exact",
      extension,
    )
  }

  if (requestedExtension || intent) return unresolvedDecision(request, directory)
  return fallbackDecision(request, directory, "no_target")
}
