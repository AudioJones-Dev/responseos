import { DEFAULT_TELNYX_HUBSPOT_SYNC_POLICY } from "@/lib/providers/crm/policy"
import type {
  CrmSyncRequest,
  CrmSyncResult,
} from "@/lib/providers/crm/types"

export const MOCK_TELNYX_HUBSPOT_SYNC_REQUEST = {
  accountId: "org_mock_1",
  callId: "call_mock_h0_1",
  sourceEventId: "webhook_mock_h0_1",
  operationKey: "hubspot:org_mock_1:call_mock_h0_1:call-v1",
  occurredAt: "2026-01-01T00:00:45.000Z",
  contactCandidate: {
    phoneE164: "+15550102020",
    verifiedEmail: "prospect@example.com",
    firstName: "Jordan",
    lastName: "Prospect",
  },
  callActivity: {
    startedAt: "2026-01-01T00:00:00.000Z",
    direction: "inbound",
    status: "completed",
    durationSeconds: 45,
    fromE164: "+15550102020",
    toE164: "+15550101010",
    sanitizedSummary: "Caller requested a service assessment and a callback.",
    intent: "service_assessment",
    qualificationFacts: ["Service location provided"],
    nextAction: "Operator callback",
  },
  policyVersion: DEFAULT_TELNYX_HUBSPOT_SYNC_POLICY.version,
  requestedOperations: {
    contact: "upsert",
    call: "create",
    note: "skip",
    deal: "skip",
  },
} as const satisfies CrmSyncRequest

export const MOCK_TELNYX_HUBSPOT_SYNC_RESULT = {
  status: "succeeded",
  providerId: "mock",
  accountId: MOCK_TELNYX_HUBSPOT_SYNC_REQUEST.accountId,
  callId: MOCK_TELNYX_HUBSPOT_SYNC_REQUEST.callId,
  sourceEventId: MOCK_TELNYX_HUBSPOT_SYNC_REQUEST.sourceEventId,
  operationKey: MOCK_TELNYX_HUBSPOT_SYNC_REQUEST.operationKey,
  policyVersion: MOCK_TELNYX_HUBSPOT_SYNC_REQUEST.policyVersion,
  contactResolution: "created",
  providerObjects: {
    contactId: "mock-contact:org_mock_1:call_mock_h0_1",
    callId: "mock-call:org_mock_1:call_mock_h0_1",
  },
  attemptCount: 1,
  providerResponseCategory: "mock_success",
  completedAt: "2026-01-01T00:00:46.000Z",
  evidenceRef: MOCK_TELNYX_HUBSPOT_SYNC_REQUEST.sourceEventId,
} as const satisfies CrmSyncResult
