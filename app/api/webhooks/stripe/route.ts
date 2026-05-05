import { ackWebhook, methodNotAllowed, safeJson } from "@/lib/providers/webhook-helpers";

// TODO: verify Stripe-Signature header with STRIPE_WEBHOOK_SECRET (constructEvent) before processing.
export async function POST(req: Request) {
  const parsed = await safeJson(req);
  return ackWebhook({ provider: "stripe", payload: parsed });
}

export const GET = methodNotAllowed;
