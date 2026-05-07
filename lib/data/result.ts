/**
 * Canonical Result<T> envelope per docs/v0.2-implementation-spec.md §4 and
 * docs/api-spec.md. Every accessor in lib/data/* returns one of these shapes.
 */

export type Result<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
        details?: Record<string, unknown>;
      };
    };

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function err<T = never>(
  code: string,
  message: string,
  details?: Record<string, unknown>,
): Result<T> {
  return { ok: false, error: { code, message, details } };
}

/**
 * Wraps a thrown auth/role/tenant-scope error into a Result envelope so
 * accessors can stay non-throwing for caller convenience.
 */
export function errFromThrown<T = never>(thrown: unknown): Result<T> {
  if (thrown instanceof Error) {
    const codedErr = thrown as Error & { code?: string };
    return err<T>(codedErr.code ?? "internal_error", thrown.message);
  }
  return err<T>("internal_error", "Unknown error.");
}
