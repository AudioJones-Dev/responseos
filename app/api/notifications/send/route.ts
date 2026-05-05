import { NextResponse } from "next/server";
import { errorResponse, methodNotAllowed, safeJson } from "@/lib/providers/webhook-helpers";
import type { NotificationChannel } from "@/types/notification";

interface SendRequest {
  channel: NotificationChannel;
  recipient: string;
  subject?: string;
  message: string;
}

// TODO: route to provider adapter (Twilio for sms, Resend for email, Slack for slack, internal for in_app).
export async function POST(req: Request) {
  const parsed = await safeJson<SendRequest>(req);
  if (!parsed.ok) {
    return errorResponse(400, parsed.error);
  }
  return NextResponse.json({
    ok: true,
    mock: true,
    data: { ...parsed.data, status: "queued" },
  });
}

export const GET = methodNotAllowed;
