import { NextResponse } from "next/server";
import { getMockCalls } from "@/lib/mock/calls";

export async function GET() {
  return NextResponse.json({ ok: true, mock: true, data: getMockCalls() });
}
