import { errorResponse, respondWithResult } from "@/lib/providers/webhook-helpers";
import type { Result } from "@/lib/data/result";

export function setupResponse<T>(result: Result<T>, successStatus = 200) {
  if (!result.ok && ["duplicate_account", "setup_conflict"].includes(result.error.code)) return errorResponse(409, result.error);
  if (!result.ok && result.error.code === "setup_write_blocked") return errorResponse(403, result.error);
  return respondWithResult(result, { successStatus });
}
