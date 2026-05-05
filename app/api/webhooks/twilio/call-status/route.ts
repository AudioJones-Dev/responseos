import { ackWebhook, methodNotAllowed, safeJson } from "@/lib/providers/webhook-helpers";

// TODO: verify Twilio request signature (X-Twilio-Signature) before processing.
export async function POST(req: Request) {
  const parsed = await safeJson(req);
  return ackWebhook({ provider: "twilio_call_status", payload: parsed });
}

export const GET = methodNotAllowed;
