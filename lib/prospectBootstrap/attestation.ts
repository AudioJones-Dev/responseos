import { createPublicKey, verify } from "node:crypto";
import { z } from "zod";
import { validateProspectAssistantPreflight } from "./template";

const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
const MAX_ATTESTATION_AGE_MS = 24 * 60 * 60 * 1000;
const CLOCK_SKEW_MS = 5 * 60 * 1000;

const ProviderAttestationPayloadSchema = z.object({
  provider: z.literal("telnyx"),
  providerNumberId: z.string().min(1),
  e164: z.string().min(1),
  assistantId: z.string().min(1),
  templateVersion: z.string().min(1),
  templateChecksum: z.string().min(1),
  initializationWebhookConfigured: z.boolean(),
  recordingEnabled: z.boolean(),
  providerMemoryEnabled: z.boolean(),
  allowedTools: z.array(z.string()),
  attestedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
});

const SignedProviderAttestationSchema = z.object({
  payload: ProviderAttestationPayloadSchema,
  signature: z.string().min(1),
});

export type SignedProviderAttestation = z.infer<typeof SignedProviderAttestationSchema>;

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stableValue(nested)]),
    );
  }
  return value;
}

export function canonicalProviderAttestationPayload(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

function publicKeyFromConfig(value: string) {
  if (value.includes("BEGIN PUBLIC KEY")) return createPublicKey(value);
  const raw = Buffer.from(value, "base64");
  if (raw.length !== 32) throw new Error("provider_attestation_public_key_invalid");
  return createPublicKey({
    key: Buffer.concat([ED25519_SPKI_PREFIX, raw]),
    format: "der",
    type: "spki",
  });
}

function canonicalE164(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  throw new Error("provider_attestation_e164_invalid");
}

export function verifyProspectProviderAttestation(params: {
  value: unknown;
  providerNumberId: string;
  e164: string;
  publicKey: string | undefined;
  now?: Date;
}): SignedProviderAttestation {
  if (!params.publicKey) throw new Error("provider_attestation_key_missing");
  const attestation = SignedProviderAttestationSchema.parse(params.value);
  const payload = attestation.payload;
  const now = params.now ?? new Date();
  const attestedAt = new Date(payload.attestedAt);
  const expiresAt = new Date(payload.expiresAt);
  if (payload.providerNumberId !== params.providerNumberId) throw new Error("provider_attestation_number_id_mismatch");
  if (canonicalE164(payload.e164) !== canonicalE164(params.e164)) throw new Error("provider_attestation_e164_mismatch");
  if (attestedAt.getTime() > now.getTime() + CLOCK_SKEW_MS) throw new Error("provider_attestation_from_future");
  if (expiresAt <= now) throw new Error("provider_attestation_expired");
  if (expiresAt.getTime() - attestedAt.getTime() > MAX_ATTESTATION_AGE_MS) throw new Error("provider_attestation_window_too_long");
  const valid = verify(
    null,
    Buffer.from(canonicalProviderAttestationPayload(payload)),
    publicKeyFromConfig(params.publicKey),
    Buffer.from(attestation.signature, "base64"),
  );
  if (!valid) throw new Error("provider_attestation_signature_invalid");
  validateProspectAssistantPreflight(payload);
  return attestation;
}
