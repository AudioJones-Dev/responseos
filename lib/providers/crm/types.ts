export type CrmProviderId = "mock" | "hubspot"

export interface CrmContactUpsert {
  accountId: string
  externalId: string
  email?: string
  phone?: string
  firstName?: string
  lastName?: string
}

export interface CrmContact {
  providerContactId: string
  accountId: string
  externalId: string
  email: string | null
  phone: string | null
  firstName: string | null
  lastName: string | null
  syncedAt: string
}

export interface CrmEvent {
  accountId: string
  contactExternalId: string
  eventType: string
  payload: Record<string, string>
}

export interface CrmEventResult {
  providerEventId: string
  accountId: string
  status: "accepted" | "rejected"
  recordedAt: string
}

export type CrmContactMatchField = "e164_phone" | "verified_email"

export interface CrmSyncPolicy {
  readonly version: string
  readonly contactMatchOrder: readonly CrmContactMatchField[]
  readonly ambiguousContactAction: "review_required"
  readonly existingFieldWriteMode: "fill_empty_only"
  readonly transcriptExport: "sanitized_summary_only"
  readonly recordingExport: "disabled"
  readonly noteCreation: "disabled" | "enabled"
  readonly dealCreation: "disabled" | "qualified_or_appointment"
  readonly ownerAssignment: "preserve"
}

export interface CrmSyncContactCandidate {
  readonly phoneE164: string
  readonly verifiedEmail?: string
  readonly firstName?: string
  readonly lastName?: string
}

export interface CrmSyncCallActivity {
  readonly startedAt: string
  readonly direction: "inbound" | "outbound"
  readonly status: "completed" | "failed" | "no_answer" | "busy"
  readonly durationSeconds: number
  readonly fromE164: string
  readonly toE164: string
  readonly sanitizedSummary: string
  readonly intent?: string
  readonly qualificationFacts?: readonly string[]
  readonly nextAction?: string
}

export interface CrmSyncRequestedOperations {
  readonly contact: "upsert"
  readonly call: "create"
  readonly note: "skip" | "create"
  readonly deal: "skip" | "create"
}

export interface CrmSyncRequest {
  readonly accountId: string
  readonly callId: string
  readonly sourceEventId: string
  readonly operationKey: string
  readonly occurredAt: string
  readonly contactCandidate: CrmSyncContactCandidate
  readonly callActivity: CrmSyncCallActivity
  readonly policyVersion: string
  readonly requestedOperations: CrmSyncRequestedOperations
}

export type CrmSyncStatus =
  | "succeeded"
  | "retryable_failure"
  | "permanent_failure"
  | "review_required"
  | "skipped"

export type CrmContactResolution =
  | "created"
  | "matched"
  | "updated"
  | "ambiguous"
  | "skipped"

export interface CrmSyncProviderObjects {
  readonly contactId?: string
  readonly callId?: string
  readonly noteId?: string
  readonly dealId?: string
}

export interface CrmSyncResult {
  readonly status: CrmSyncStatus
  readonly providerId: CrmProviderId
  readonly accountId: string
  readonly callId: string
  readonly sourceEventId: string
  readonly operationKey: string
  readonly policyVersion: string
  readonly contactResolution: CrmContactResolution
  readonly providerObjects: CrmSyncProviderObjects
  readonly attemptCount: number
  readonly providerResponseCategory?: string
  readonly redactedError?: {
    readonly code: string
    readonly message: string
  }
  readonly completedAt: string
  readonly evidenceRef: string
}

export interface CrmProvider {
  readonly providerId: CrmProviderId
  upsertContact(contact: CrmContactUpsert): Promise<CrmContact>
  recordEvent(event: CrmEvent): Promise<CrmEventResult>
}
