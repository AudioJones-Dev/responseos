import { NextResponse } from "next/server";
import { getMockQuoteRequests } from "@/lib/mock/quotes";

export async function GET() {
  return NextResponse.json({ ok: true, mock: true, data: getMockQuoteRequests() });
}
