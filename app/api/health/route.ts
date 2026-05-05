import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "responseos",
    version: "0.1.0",
  });
}
