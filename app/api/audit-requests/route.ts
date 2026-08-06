import { NextResponse } from "next/server";
import { createInboundAudit } from "@/lib/data/inboundAudits";
import { notifyInboundAudit } from "@/lib/notify/inboundAudit";
import {
  errorResponse,
  methodNotAllowed,
  safeJson,
} from "@/lib/providers/webhook-helpers";
import { AuditRequestSchema } from "@/lib/validation/audit-request";

// Public marketing capture for the /audit form. Unauthenticated by design —
// persists to the inbound prospect pool when DB is available (ADR-0040).
// No CRM/provider write until Gate Set B / live v0.3.
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

  const created = await createInboundAudit(result.data);
  if (!created.ok) {
    return errorResponse(500, {
      code: created.error.code,
      message: created.error.message,
    });
  }

  const notify = await notifyInboundAudit(created.data);

  return NextResponse.json({
    ok: true,
    mock: !created.data.persisted,
    data: {
      reference: created.data.reference,
      id: created.data.id,
      status: created.data.status,
      persisted: created.data.persisted,
      notified: notify.notified,
    },
  });
}

export const GET = methodNotAllowed;
