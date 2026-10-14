import { retryCompletedInteractionNotification } from "@/lib/notifications/completedInteraction";
import { respondWithResult } from "@/lib/providers/webhook-helpers";

/** Operator replay of a failed completed-interaction notification (ADR-0057). */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return respondWithResult(await retryCompletedInteractionNotification({ id }));
}
