import { NextResponse } from "next/server";
import { getMockOrganizations } from "@/lib/mock/organizations";

export async function GET() {
  return NextResponse.json({ ok: true, mock: true, data: getMockOrganizations() });
}
