import { NextResponse } from "next/server";

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
