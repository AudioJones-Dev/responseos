import {
  persistSignedFrlTestIntake,
  FrlWebIntakeError,
} from "@/lib/data/frlWebIntakes";
import { FrlTestIngressError } from "@/lib/validation/frl-test-signature";

export async function POST(request: Request) {
  try {
    const receipt = await persistSignedFrlTestIntake(request);
    return Response.json(
      { ok: true, mode: "mock", ...receipt },
      {
        status: receipt.replay ? 200 : 201,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    const status =
      error instanceof FrlTestIngressError
        ? error.status
        : error instanceof FrlWebIntakeError && error.code === "conflict"
          ? 409
          : error instanceof FrlWebIntakeError &&
              error.code === "invalid_request"
            ? 400
            : 503;
    return Response.json(
      { ok: false, message: "Test intake could not be accepted." },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
