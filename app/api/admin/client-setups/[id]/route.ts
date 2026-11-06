import { updateClientSetup } from "@/lib/clientSetup/service";
import { setupResponse } from "@/lib/clientSetup/http";
import { errorResponse, safeJson } from "@/lib/providers/webhook-helpers";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const body = await safeJson(request);
  if (!body.ok) return errorResponse(400, body.error);
  const { id } = await context.params;
  return setupResponse(await updateClientSetup(id, body.data));
}
