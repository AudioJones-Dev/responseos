import { floridaRampLiftOperatingConfiguration } from "@/lib/config/clients/florida-ramp-lift";
import { contentHash } from "@/lib/prospectBootstrap/memory";
import type { QualifiedHandoffPolicy } from "@/lib/crm/qualifiedHandoffPolicy";

export const syntheticHandoffPolicy: QualifiedHandoffPolicy = {
  crmOwnerId: "12345",
  crmContactBaseUrl: "https://app.hubspot.com/contacts/98765/record/0-1/",
  notification: { channel: "email", recipient: "owner@example.com" },
};

export function syntheticHandoffSnapshot(accountId: string, policy: unknown = syntheticHandoffPolicy) {
  const now = new Date("2026-10-06T12:00:00Z");
  const memory = floridaRampLiftOperatingConfiguration({ accountId, generatedAt: now });
  memory.policies.push({
    id: "synthetic-policy", key: "policy.qualified_handoff", value: policy,
    status: "operator_configured", sourceIds: ["synthetic-approval"],
    sourceEvidence: [{ kind: "operator_assertion", sourceId: "synthetic-approval",
      recordRef: "test-fixture-only", contentHash: contentHash(policy),
      assertedBy: "synthetic-operator", assertedAt: now.toISOString() }],
    confidence: null, reviewedBy: "synthetic-operator", reviewedAt: now.toISOString(),
  });
  return { id: "synthetic-snapshot", account_id: accountId, status: "approved" as const,
    approved_by: "synthetic-operator", approved_at: now, revoked_at: null,
    memory_json: memory, content_hash: contentHash(memory) };
}
