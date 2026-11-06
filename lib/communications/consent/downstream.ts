export interface ConsentedCallProposal {
  accountId: string;
  callId: string;
  sourceWebhookId: string;
  sourceSegmentIds: readonly string[];
  consentId: string;
  consentRevision: number;
  participantLegIds: readonly string[];
  captureInterval: { start: string; end: string };
  callerProvidedName: string | null;
  identityStatus: "unverified" | "verified";
  contactResolution: "unresolved" | "ambiguous" | "reviewed";
  commitments: readonly {
    text: string;
    sourceSegmentId: string;
    confidence: number;
    reviewStatus: "required" | "approved" | "rejected";
  }[];
  reviewStatus: "required";
  crmOutcome: "not_authorized";
}

export interface RoutedCallProposal extends ConsentedCallProposal {
  direction: "inbound" | "outbound";
  startedAt: string;
  endedAt: string;
  transferOutcome: "connected" | "failed" | "not_attempted";
  sourceRoutingEventIds: readonly string[];
}
