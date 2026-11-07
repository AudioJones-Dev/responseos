import { testCaller } from "@/lib/communications/pilot/test-caller";
import { parseTelnyxWebhook, verifyTelnyxWebhook } from "@/lib/providers/telnyx/webhook";

export async function POST(req: Request) {
  const publicKey = process.env.TELNYX_PUBLIC_KEY;
  if (process.env.VERCEL_ENV === "production" || process.env.RESPONSEOS_REQUIRE_AUTH !== "true" ||
      process.env.RESPONSEOS_LIVE_TELNYX_INGEST_ENABLED !== "true" || !publicKey) return new Response(null, { status: 503 });
  if (Number(req.headers.get("content-length")) > 262144) return new Response(null, { status: 413 });
  const rawBody = await req.text();
  if (Buffer.byteLength(rawBody) > 262144) return new Response(null, { status: 413 });
  if (!verifyTelnyxWebhook({ rawBody, publicKey, signature: req.headers.get("telnyx-signature-ed25519"), timestamp: req.headers.get("telnyx-timestamp") }).ok) return new Response(null, { status: 401 });
  const event = parseTelnyxWebhook(rawBody);
  const p = event?.data.payload;
  if (!p || p.connection_id !== testCaller.applicationId || p.from !== testCaller.from || p.to !== testCaller.to ||
      !["call.initiated", "call.answered", "call.hangup"].includes(event!.data.event_type)) return new Response(null, { status: 422 });
  // Caller-side lifecycle callbacks acknowledge delivery only; inbound signed receipts prove the test.
  return new Response(null, { status: 204 });
}
