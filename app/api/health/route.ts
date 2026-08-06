import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import packageJson from "../../../package.json";

export async function GET() {
  const version = packageJson.version;
  let database: "connected" | "unavailable" | "skipped" = "skipped";

  if (db !== null) {
    try {
      await db.$queryRaw`SELECT 1`;
      database = "connected";
    } catch {
      database = "unavailable";
    }
  }

  const status = database === "unavailable" ? "degraded" : ("ok" as const);

  return NextResponse.json({
    status,
    service: "responseos",
    version,
    database,
  });
}
