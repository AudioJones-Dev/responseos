import { after, NextResponse } from "next/server";
import {
  createProspectIntake,
  isValidIdempotencyKey,
} from "@/lib/data/prospectIntakes";
import { notifyProspectIntake } from "@/lib/notify/prospectIntake";
import {
  errorResponse,
  methodNotAllowed,
  safeJson,
} from "@/lib/providers/webhook-helpers";
import { AuditRequestSchema } from "@/lib/validation/audit-request";

export async function POST(req: Request) {
  if (process.env.RESPONSEOS_PUBLIC_AUDIT_INTAKE_ENABLED !== "true") {
    return errorResponse(503, {
      code: "intake_disabled",
      message: "Prospect intake is not available.",
    });
  }

  const accountId = process.env.RESPONSEOS_INBOUND_ACCOUNT_ID;
  if (!accountId) {
    return errorResponse(503, {
      code: "intake_unavailable",
      message: "Prospect intake is not configured.",
    });
  }

  const idempotencyKey = req.headers.get("idempotency-key");
  if (!isValidIdempotencyKey(idempotencyKey)) {
    return errorResponse(422, {
      code: "invalid_idempotency_key",
      message: "A valid Idempotency-Key header is required.",
    });
  }

  const parsed = await safeJson(req);
  if (!parsed.ok) {
    return errorResponse(422, parsed.error);
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

  const created = await createProspectIntake({
    accountId,
    idempotencyKey,
    request: result.data,
  });
  if (!created.ok) {
    const status = created.error.code === "idempotency_conflict" ? 422 : 503;
    return errorResponse(status, created.error);
  }

  if (!created.data.replay) {
    after(() =>
      notifyProspectIntake({
        id: created.data.intake.id,
        reference: created.data.intake.reference,
      }),
    );
  }

  return NextResponse.json(
    {
      ok: true,
      data: {
        reference: created.data.intake.reference,
        status: created.data.intake.status,
        replay: created.data.replay,
      },
    },
    { status: created.data.replay ? 200 : 201 },
  );
}

export const GET = methodNotAllowed;
