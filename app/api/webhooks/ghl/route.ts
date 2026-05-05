import { ackWebhook, methodNotAllowed, safeJson } from "@/lib/providers/webhook-helpers";

// TODO: verify GHL webhook signature before processing.
export async function POST(req: Request) {
  const parsed = await safeJson(req);
  return ackWebhook({ provider: "ghl", payload: parsed });
}

export const GET = methodNotAllowed;
