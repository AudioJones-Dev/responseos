import { NextResponse } from "next/server";
import { verifyClerkWebhook } from "@/lib/auth/clerk-webhook";
import { handleClerkEvent } from "@/lib/auth/clerk-sync";
import { errorResponse, methodNotAllowed } from "@/lib/providers/webhook-helpers";

/**
 * Clerk webhook endpoint (32C). Signature is verified before the body is
 * parsed and before any mutation (ADR-0009). Public route per proxy.ts —
 * the handler self-validates.
 */
export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    // Fail closed when unconfigured (dev/local stays safe: no real Clerk
    // traffic, no mutation).
    return errorResponse(503, {
      code: "webhook_not_configured",
      message: "CLERK_WEBHOOK_SECRET is not set.",
    });
  }

  const rawBody = await req.text();
  const svixId = req.headers.get("svix-id");
  const verification = verifyClerkWebhook({
    secret,
    payload: rawBody,
    headers: {
      svixId,
      svixTimestamp: req.headers.get("svix-timestamp"),
      svixSignature: req.headers.get("svix-signature"),
    },
  });
  if (!verification.ok) {
    return errorResponse(401, {
      code: "invalid_signature",
      message: "Webhook signature verification failed.",
    });
  }

  let event: { type: string; data: Record<string, unknown> };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return errorResponse(400, {
      code: "invalid_json",
      message: "Webhook body could not be parsed as JSON.",
    });
  }

  const result = await handleClerkEvent({
    event,
    // svix-id is guaranteed non-null here (verification rejects missing headers).
    eventId: svixId as string,
    rawBody,
  });

  if (!result.ok) {
    return errorResponse(result.error.code === "no_database" ? 503 : 500, result.error);
  }
  return NextResponse.json({ ok: true, data: result.data });
}

export const GET = methodNotAllowed;
