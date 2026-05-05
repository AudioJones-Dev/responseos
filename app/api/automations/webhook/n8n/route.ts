import { ackWebhook, methodNotAllowed, safeJson } from "@/lib/providers/webhook-helpers";

// TODO: verify n8n signature using N8N_WEBHOOK_SECRET before processing.
export async function POST(req: Request) {
  const parsed = await safeJson(req);
  return ackWebhook({ provider: "n8n_automation", payload: parsed });
}

export const GET = methodNotAllowed;
