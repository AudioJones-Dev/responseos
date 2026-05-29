import { z } from "zod";

/**
 * Per-provider raw webhook payload schemas. v0.2 only validates SHAPE; real
 * signature verification is a v0.3 task per spec §4 + §6.
 */

export const WebhookProviderSchema = z.enum([
  "twilio",
  "retell",
  "vapi",
  "bland",
  "stripe",
  "ghl",
  "n8n",
]);
export type WebhookProvider = z.infer<typeof WebhookProviderSchema>;

export const TwilioVoiceWebhookSchema = z.object({
  CallSid: z.string().min(1),
  AccountSid: z.string().min(1),
  From: z.string().min(1),
  To: z.string().min(1),
  CallStatus: z.string().optional(),
  Direction: z.string().optional(),
});

export const TwilioSmsWebhookSchema = z.object({
  MessageSid: z.string().min(1),
  AccountSid: z.string().min(1),
  From: z.string().min(1),
  To: z.string().min(1),
  Body: z.string().optional(),
});

export const RetellCallEndedSchema = z.object({
  call_id: z.string().min(1),
  agent_id: z.string().optional(),
  call_status: z.string().optional(),
  start_timestamp: z.number().optional(),
  end_timestamp: z.number().optional(),
  transcript: z.string().optional(),
});

export const StripeEventSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  data: z.object({ object: z.unknown() }),
  created: z.number().optional(),
  livemode: z.boolean().optional(),
});

export const GHLContactWebhookSchema = z.object({
  type: z.string().min(1),
  locationId: z.string().optional(),
  contactId: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Envelope for the WebhookEvent ingest path. Phase B/C never writes through
 * this — Phase D + v0.3 ingest do.
 */
export const WebhookIngestEnvelopeSchema = z.object({
  provider: WebhookProviderSchema,
  provider_event_id: z.string().min(1),
  event_type: z.string().min(1),
  raw_body: z.string(),
  signature_header: z.string().nullable().optional(),
  account_id: z.string().optional(),
});
export type WebhookIngestEnvelope = z.infer<typeof WebhookIngestEnvelopeSchema>;
