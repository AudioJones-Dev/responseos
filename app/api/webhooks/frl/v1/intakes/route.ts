import { db } from "@/lib/db/client";
import { authenticateHostedIntake, HostedIntakeError } from "@/lib/routing/hostedAuth";
import { persistHostedIntake } from "@/lib/routing/ledger";
export async function POST(request: Request) {
  try {
    const verified = await authenticateHostedIntake(request);
    if (!db) throw new HostedIntakeError(503, "database_unavailable");
    const receipt = await persistHostedIntake(db, verified.authority, verified.submissionId, verified.payload);
    return Response.json({ ok: true, ...receipt }, { status: receipt.replay ? 200 : 202, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, code: error instanceof HostedIntakeError ? error.code : "intake_unavailable" }, { status: error instanceof HostedIntakeError ? error.status : 503, headers: { "Cache-Control": "no-store" } });
  }
}
