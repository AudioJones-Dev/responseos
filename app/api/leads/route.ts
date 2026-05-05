import { NextResponse } from "next/server";
import { getMockLeadEvents } from "@/lib/mock/leads";

export async function GET() {
  return NextResponse.json({ ok: true, mock: true, data: getMockLeadEvents() });
}
