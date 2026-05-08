import { computeDedupeHash } from "@/lib/data/webhookEvents";
import type { Prisma } from "@prisma/client";

let webhookEventCounter = 0;

export function makeWebhookEvent(
  params: { provider: string; organizationId?: string | null },
  overrides: Partial<Prisma.WebhookEventCreateInput> = {},
): Prisma.WebhookEventCreateInput {
  webhookEventCounter += 1;
  const suffix = webhookEventCounter.toString().padStart(3, "0");
  const provider_event_id = `event_test_${suffix}`;

  return {
    id: `webhook_test_${suffix}`,
    organization_id: params.organizationId ?? null,
    provider: params.provider,
    provider_event_id,
    event_type: "test.event",
    raw_body: JSON.stringify({ id: provider_event_id }),
    signature_header: "test-signature",
    signature_valid: false,
    dedupe_hash: computeDedupeHash(params.provider, provider_event_id),
    process_status: "received",
    ...overrides,
  };
}
