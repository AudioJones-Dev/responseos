import { NextResponse } from "next/server";
import packageJson from "@/package.json";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "responseos",
    version: packageJson.version,
    build_sha: process.env.RESPONSEOS_BUILD_SHA ?? "local",
    environment: process.env.VERCEL_ENV ?? "local",
  });
}
