import { NextResponse } from "next/server";
import { importBootstrapPromotion } from "@/lib/prospectBootstrap/service";
import { errorResponse, safeJson } from "@/lib/providers/webhook-helpers";

export async function POST(req: Request) {
  const parsed = await safeJson<{ manifest?: unknown; manifestHash?: unknown }>(req);
  if (!parsed.ok) return errorResponse(400, parsed.error);
  if (typeof parsed.data.manifestHash !== "string" || parsed.data.manifest === undefined) {
    return errorResponse(422, { code: "validation_failed", message: "manifest and manifestHash are required." });
  }
  const result = await importBootstrapPromotion({ manifest: parsed.data.manifest, manifestHash: parsed.data.manifestHash });
  if (!result.ok) {
    const status = result.error.code === "no_session"
      ? 401
      : result.error.code === "role_denied"
        ? 403
        : result.error.code === "promotion_import_disabled"
          ? 503
          : 422;
    return NextResponse.json(result, { status });
  }
  return NextResponse.json(result, { status: result.data.replay ? 200 : 201 });
}
