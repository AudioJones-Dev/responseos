import { createClientSetup } from "@/lib/clientSetup/service";
import { setupResponse } from "@/lib/clientSetup/http";
import { errorResponse, safeJson } from "@/lib/providers/webhook-helpers";

export async function POST(request: Request) {
  const body = await safeJson(request);
  if (!body.ok) return errorResponse(400, body.error);
  return setupResponse(await createClientSetup(body.data), 201);
}
