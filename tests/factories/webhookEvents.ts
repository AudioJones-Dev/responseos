import type { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { nextTestId } from "./ids";

function dedupeHash(provider: string, providerEventId: string): string {
  return createHash("sha256").update(`${provider}:${providerEventId}`).digest("hex");
}

export function makeWebhookEvent(
  params: { provider: string; organizationId?: string | null },
  overrides: Partial<Prisma.WebhookEventCreateInput> = {},
): Prisma.WebhookEventCreateInput {
  const provider_event_id = String(overrides.provider_event_id ?? nextTestId("provider_event"));
  const provider = String(overrides.provider ?? params.provider);
  const base: Prisma.WebhookEventCreateInput = {
    id: overrides.id ?? nextTestId("webhook"),
    organization_id: params.organizationId ?? null,
    provider,
    provider_event_id,
    event_type: "test.event",
    raw_body: JSON.stringify({ id: provider_event_id }),
    signature_header: "test-signature",
    signature_valid: false,
    dedupe_hash: overrides.dedupe_hash ?? dedupeHash(provider, provider_event_id),
    process_status: "received",
  };
  return { ...base, ...overrides };
}
