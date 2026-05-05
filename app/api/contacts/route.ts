import { NextResponse } from "next/server";
import { getMockContacts } from "@/lib/mock/contacts";

export async function GET() {
  return NextResponse.json({ ok: true, mock: true, data: getMockContacts() });
}
