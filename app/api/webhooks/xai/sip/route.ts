import { acceptGrokIncoming } from "@/lib/grok/service";

export async function POST(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return Response.json({ ok: false }, { status: 415 });
  const reader = request.body?.getReader();
  if (!reader) return Response.json({ ok: false }, { status: 400 });
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 65536) { await reader.cancel(); return Response.json({ ok: false }, { status: 413 }); }
    chunks.push(value);
  }
  try {
    const data = await acceptGrokIncoming(Buffer.concat(chunks).toString("utf8"), request.headers);
    return Response.json({ ok: true, data }, { status: 202 });
  } catch {
    return Response.json({ ok: false, error: "grok_ingestion_unqualified_or_unverified" }, { status: 503 });
  }
}
