import { ackWebhook, methodNotAllowed, safeJson } from "@/lib/providers/webhook-helpers";

// TODO: verify Vapi webhook signature before processing.
export async function POST(req: Request) {
  const parsed = await safeJson(req);
  return ackWebhook({ provider: "vapi_call_ended", payload: parsed });
}

export const GET = methodNotAllowed;
