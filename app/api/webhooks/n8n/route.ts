import { ackWebhook, methodNotAllowed, safeJson } from "@/lib/providers/webhook-helpers";

// TODO: verify shared secret header against N8N_WEBHOOK_SECRET before processing.
export async function POST(req: Request) {
  const parsed = await safeJson(req);
  return ackWebhook({ provider: "n8n", payload: parsed });
}

export const GET = methodNotAllowed;
