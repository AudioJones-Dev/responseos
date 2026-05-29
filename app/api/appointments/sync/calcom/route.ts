import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    ok: true,
    mock: true,
    provider: "calcom",
    note: "stub: will sync booking to Cal.com via API key per workspace",
  });
}
