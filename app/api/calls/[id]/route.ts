import { Calls } from "@/lib/data";
import { respondWithResult } from "@/lib/providers/webhook-helpers";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return respondWithResult(await Calls.getCallById(id));
}
