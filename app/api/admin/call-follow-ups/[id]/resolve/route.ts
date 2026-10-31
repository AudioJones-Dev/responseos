import { NextResponse } from "next/server";
import { resolveCallFollowUp } from "@/lib/followUp/service";
import { errorResponse, respondWithResult } from "@/lib/providers/webhook-helpers";

export async function POST(_req: Request, context: { params: Promise<{ id: string }> }) {
  const accountId = process.env.RESPONSEOS_DEMO_ACCOUNT_ID;
  if (!accountId) {
    return errorResponse(503, { code: "demo_account_unavailable", message: "The demo account is not configured." });
  }
  const { id } = await context.params;
  const result = await resolveCallFollowUp({ id, accountId });
  if (!result.ok && result.error.code === "invalid_transition") return errorResponse(422, result.error);
  if (!result.ok) return respondWithResult(result);
  return NextResponse.json({ ok: true, data: result.data });
}
