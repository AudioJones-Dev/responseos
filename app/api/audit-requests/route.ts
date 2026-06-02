import { NextResponse } from "next/server";
import {
  errorResponse,
  methodNotAllowed,
  safeJson,
} from "@/lib/providers/webhook-helpers";
import { AuditRequestSchema } from "@/lib/validation/audit-request";

// Public marketing capture for the /audit form. Unauthenticated by design —
// it acknowledges the request only (mock). No CRM/provider write until v0.3.
export async function POST(req: Request) {
  const parsed = await safeJson(req);
  if (!parsed.ok) {
    return errorResponse(400, parsed.error);
  }

  const result = AuditRequestSchema.safeParse(parsed.data);
  if (!result.success) {
    return errorResponse(422, {
      code: "validation_failed",
      message: "Audit request failed validation.",
      details: {
        issues: result.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
    });
  }

  const reference = `audit_${Date.now().toString(36)}`;
  if (process.env.NODE_ENV !== "test") {
    // Reference only — never log untrusted prospect PII to the server stream.
    console.log(`[audit-request] mock capture ref=${reference}`);
  }

  return NextResponse.json({
    ok: true,
    mock: true,
    data: { reference, status: "received", ...result.data },
  });
}

export const GET = methodNotAllowed;
