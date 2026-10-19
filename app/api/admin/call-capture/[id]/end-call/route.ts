import { z } from "zod";
import { requireReviewOperator } from "@/lib/callReview/service";
import { requestOperatorEndCall } from "@/lib/callControl/endCall";
import { db } from "@/lib/db/client";
import { operatorEndGrok } from "@/lib/grok/service";

const Input = z.strictObject({ expectedAccountId: z.string().min(1).max(200), expectedProviderCallId: z.string().min(1).max(500), generation: z.number().int().positive() });
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireReviewOperator();
    const parsed = Input.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return Response.json({ ok: false, error: "invalid_end_call_request" }, { status: 422 });
    const captureId = (await context.params).id;
    const grok = await db?.grokCallSession.findUnique({ where: { capture_id: captureId } });
    if (grok) {
      const capture = await db!.callCaptureSession.findUniqueOrThrow({ where: { id: captureId } });
      if (capture.account_id !== parsed.data.expectedAccountId || capture.provider_call_id !== parsed.data.expectedProviderCallId || capture.generation !== parsed.data.generation) throw Error("end_call_target_mismatch");
      const data = await operatorEndGrok(capture);
      return Response.json({ ok: true, data }, { status: data.disconnection.confirmed ? 200 : 202, headers: { "Cache-Control": "no-store" } });
    }
    const data = await requestOperatorEndCall({ ...parsed.data, captureId });
    return Response.json({ ok: true, data }, { status: data.disconnection.confirmed ? 200 : 202, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "end_call_unavailable";
    const safe = ["operator_required", "end_call_target_mismatch", "end_call_identity_incomplete", "qualification_assignment_required", "end_call_ineligible"];
    return Response.json({ ok: false, error: safe.includes(reason) ? reason : "end_call_result_uncertain" }, { status: reason === "operator_required" ? 403 : safe.includes(reason) ? 409 : 503 });
  }
}
