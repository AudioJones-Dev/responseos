import { NextResponse } from "next/server";
import type { Result } from "@/lib/data/result";

interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export function errorResponse(
  status: number,
  error: ApiError,
): Response {
  return NextResponse.json({ ok: false, error }, { status });
}

/**
 * Maps a `lib/data/*` Result<T> envelope to an HTTP response using the
 * canonical envelope from docs/api-spec.md. Status codes follow the same
 * spec: 401 for no_session, 403 for role/tenant denials, 404 for not_found,
 * 422 for validation, 500 for everything else.
 *
 * Pass `transform` to reshape the success payload (e.g. wrap a list in
 * `{ account_id, metrics }`) while keeping the error envelope mapping.
 */
export function respondWithResult<T, U = T>(
  result: Result<T>,
  options: { successStatus?: number; transform?: (data: T) => U } = {},
): Response {
  const { successStatus = 200, transform } = options;
  if (result.ok) {
    const data = (transform ? transform(result.data) : result.data) as T | U;
    return NextResponse.json({ ok: true, data }, { status: successStatus });
  }
  return errorResponse(statusForCode(result.error.code), result.error);
}

export function statusForCode(code: string): number {
  switch (code) {
    case "no_session":
      return 401;
    case "role_denied":
    case "tenant_scope_denied":
      return 403;
    case "not_found":
      return 404;
    case "invalid_json":
      return 400;
    case "validation_failed":
    case "invalid_input":
      return 422;
    default:
      return 500;
  }
}

export function methodNotAllowed(): Response {
  return errorResponse(405, {
    code: "method_not_allowed",
    message: "HTTP method not allowed for this route.",
  });
}

export async function safeJson<T = unknown>(
  req: Request,
): Promise<{ ok: true; data: T } | { ok: false; error: ApiError }> {
  try {
    const data = (await req.json()) as T;
    return { ok: true, data };
  } catch {
    return {
      ok: false,
      error: {
        code: "invalid_json",
        message: "Request body could not be parsed as JSON.",
      },
    };
  }
}

interface AckOptions {
  provider: string;
  payload?: unknown;
}

export function ackWebhook({ provider, payload }: AckOptions): Response {
  if (process.env.NODE_ENV !== "test") {
    // Lightweight ingest log so operators can see traffic in dev.
    console.log(
      `[webhook] provider=${provider}`,
      typeof payload === "object" && payload !== null
        ? Object.keys(payload as Record<string, unknown>)
        : payload,
    );
  }
  return NextResponse.json({
    ok: true,
    data: { received: true, provider, mock: true },
  });
}
