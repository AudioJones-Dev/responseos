import type { CrmSyncPolicy } from "@/lib/providers/crm/types"

export const DEFAULT_TELNYX_HUBSPOT_SYNC_POLICY = {
  version: "telnyx-hubspot-h0-v1",
  contactMatchOrder: ["e164_phone", "verified_email"],
  ambiguousContactAction: "review_required",
  existingFieldWriteMode: "fill_empty_only",
  transcriptExport: "sanitized_summary_only",
  recordingExport: "disabled",
  noteCreation: "disabled",
  dealCreation: "disabled",
  ownerAssignment: "preserve",
} as const satisfies CrmSyncPolicy
