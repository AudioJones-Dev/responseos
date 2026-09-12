import { randomUUID } from "node:crypto";
import {
  BootstrapPromotionManifestSchema,
  PROSPECT_AGENT_TEMPLATE_VERSION,
  type BootstrapPromotionManifest,
  type BusinessMemorySnapshot,
} from "./contracts";
import { contentHash } from "./memory";

const SECRET_KEY_PATTERN = /(secret|token|password|credential|api[_-]?key|raw_body|transcript|recording)/i;

export function assertNoForbiddenPromotionKeys(value: unknown, path = "manifest"): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoForbiddenPromotionKeys(entry, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const isSafeRecordingGate = key === "recordingEnabled" && nested === false;
    if (!isSafeRecordingGate && SECRET_KEY_PATTERN.test(key)) throw new Error(`promotion_forbidden_field:${path}.${key}`);
    assertNoForbiddenPromotionKeys(nested, `${path}.${key}`);
  }
}

export function validatePromotionManifest(
  value: unknown,
  expectedHash?: string,
): BootstrapPromotionManifest {
  const manifest = BootstrapPromotionManifestSchema.parse(value);
  assertNoForbiddenPromotionKeys(manifest);
  if (
    manifest.memory.accountId !== manifest.sourceAccountId ||
    manifest.memory.bootstrapId !== manifest.sourceBootstrapId
  ) {
    throw new Error("promotion_source_identity_mismatch");
  }
  if (contentHash(manifest.memory) !== manifest.sourceSnapshotHash) {
    throw new Error("promotion_snapshot_hash_mismatch");
  }
  if (expectedHash && contentHash(manifest) !== expectedHash) {
    throw new Error("promotion_manifest_hash_mismatch");
  }
  return manifest;
}

export function buildPromotionManifest(params: {
  bootstrapId: string;
  accountId: string;
  snapshotId: string;
  snapshotHash: string;
  memory: BusinessMemorySnapshot;
  businessName: string;
  canonicalWebsite: string;
  timezone: string;
  policy: Record<string, unknown>;
  numberRetentionIntent?: "new_production_number" | "request_demo_number_review";
  now?: Date;
  correlationId?: string;
}): { manifest: BootstrapPromotionManifest; hash: string } {
  const manifest = BootstrapPromotionManifestSchema.parse({
    schemaVersion: "prospect-promotion.v1",
    correlationId: params.correlationId ?? randomUUID(),
    sourceBootstrapId: params.bootstrapId,
    sourceAccountId: params.accountId,
    sourceSnapshotId: params.snapshotId,
    sourceSnapshotHash: params.snapshotHash,
    exportedAt: (params.now ?? new Date()).toISOString(),
    businessIdentity: {
      name: params.businessName,
      canonicalWebsite: params.canonicalWebsite,
      industry: "home-services",
      timezone: params.timezone,
    },
    memory: params.memory,
    agent: {
      templateVersion: PROSPECT_AGENT_TEMPLATE_VERSION,
      executionMode: "PROSPECT_DEMO",
      policy: params.policy,
    },
    numberRetentionIntent: params.numberRetentionIntent ?? "new_production_number",
  });
  assertNoForbiddenPromotionKeys(manifest);
  return { manifest, hash: contentHash(manifest) };
}
