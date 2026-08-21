import { registerTelephonyNumber } from "@/lib/prospectBootstrap/service";
import { errorResponse, respondWithResult, safeJson } from "@/lib/providers/webhook-helpers";

export async function POST(req: Request) {
  const parsed = await safeJson<{
    providerNumberId?: string;
    providerAttestation?: unknown;
    e164?: string;
    evergreen?: boolean;
    monthlyCostMicros?: number;
  }>(req);
  if (!parsed.ok) return errorResponse(400, parsed.error);
  if (!parsed.data.providerNumberId || !parsed.data.providerAttestation || !parsed.data.e164) {
    return errorResponse(422, { code: "validation_failed", message: "Existing Telnyx number, number ID, and signed provider attestation are required." });
  }
  return respondWithResult(await registerTelephonyNumber({
    providerNumberId: parsed.data.providerNumberId,
    providerAttestation: parsed.data.providerAttestation,
    e164: parsed.data.e164,
    evergreen: parsed.data.evergreen,
    monthlyCostMicros: parsed.data.monthlyCostMicros,
  }), { successStatus: 201 });
}
