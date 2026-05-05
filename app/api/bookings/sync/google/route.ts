import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    ok: true,
    mock: true,
    provider: "google_calendar",
    note: "stub: will sync booking to Google Calendar via OAuth tokens stored per workspace",
  });
}
