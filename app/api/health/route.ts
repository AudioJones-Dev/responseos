import { NextResponse } from "next/server";
import packageJson from "@/package.json";
import { watchdogReady } from "@/lib/grok/watchdogReadiness";

export const dynamic = "force-dynamic";

export async function GET() {
  const required = process.env.RESPONSEOS_QUALIFICATION_ACTIVATION === "ENABLED";
  const ready = !required || await watchdogReady();
  return NextResponse.json({
    status: ready ? "ok" : "not_ready",
    service: "responseos",
    version: packageJson.version,
    build_sha: process.env.RESPONSEOS_BUILD_SHA ?? "local",
    environment: process.env.VERCEL_ENV ?? "local",
    ...(required ? { watchdogReady: ready } : {}),
  }, { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
