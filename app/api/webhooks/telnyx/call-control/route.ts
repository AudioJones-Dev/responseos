import { ingestCallControlEvent } from "@/lib/callControl/service";
import { errorResponse } from "@/lib/providers/webhook-helpers";
import { parseCallControlEvent } from "@/lib/providers/telnyx/callControl";
import { verifyTelnyxWebhook } from "@/lib/providers/telnyx/webhook";

export async function POST(req: Request) {
  const publicKey = process.env.TELNYX_PUBLIC_KEY;
  if (process.env.RESPONSEOS_LIVE_TELNYX_INGEST_ENABLED !== "true" || !publicKey) return errorResponse(503, { code: "telnyx_ingest_disabled", message: "Telnyx Call Control ingestion is disabled." });
  if (!/^application\/json(?:\s*;.*)?$/i.test(req.headers.get("content-type") ?? "")) return errorResponse(415, { code: "unsupported_telnyx_event_content_type", message: "Call Control accepts signed JSON only." });
  const rawBody = await req.text();
  const signature = req.headers.get("telnyx-signature-ed25519");
  const verified = verifyTelnyxWebhook({ rawBody, signature, timestamp: req.headers.get("telnyx-timestamp"), publicKey });
  if (!verified.ok) return errorResponse(401, { code: `telnyx_signature_${verified.reason}`, message: "Telnyx webhook signature is invalid or stale." });
  const event = parseCallControlEvent(rawBody);
  if (!event) return errorResponse(422, { code: "invalid_call_control_event", message: "The signed Call Control event is not supported." });
  try {
    const result = await ingestCallControlEvent({ event, rawBody, signature: signature!, timestamp: req.headers.get("telnyx-timestamp")! });
    return Response.json({ ok: true, data: { accepted: true, ...result } });
  } catch {
    return errorResponse(503, { code: "call_control_failed", message: "Call Control processing failed closed." });
  }
}
