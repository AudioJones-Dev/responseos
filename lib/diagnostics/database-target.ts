import { createHash, timingSafeEqual } from "node:crypto";

// Temporary operator diagnostic: which database host does this deployment's
// DATABASE_URL name? It parses the URL in memory only. It never opens a
// connection, never logs, and never returns credentials, ports, query
// parameters or parser error text.

export type DatabaseTargetStatus =
  | "ok"
  | "missing"
  | "unparseable"
  | "unsupported_scheme";

export interface DatabaseTarget {
  status: DatabaseTargetStatus;
  hostname: string | null;
  database: string | null;
}

const POSTGRES_PROTOCOLS = new Set(["postgres:", "postgresql:"]);
const SHA256_HEX = /^[0-9a-f]{64}$/;

export function describeDatabaseTarget(value: string | undefined): DatabaseTarget {
  if (!value) {
    return { status: "missing", hostname: null, database: null };
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { status: "unparseable", hostname: null, database: null };
  }

  if (!POSTGRES_PROTOCOLS.has(url.protocol)) {
    return { status: "unsupported_scheme", hostname: null, database: null };
  }
  if (!url.hostname) {
    return { status: "unparseable", hostname: null, database: null };
  }

  let database: string | null = null;
  const path = url.pathname.replace(/^\//, "");
  if (path) {
    try {
      database = decodeURIComponent(path);
    } catch {
      return { status: "unparseable", hostname: null, database: null };
    }
  }

  return { status: "ok", hostname: url.hostname, database };
}

// The environment holds only the SHA-256 hex digest of the operator token, so
// the stored value is not itself usable as a credential.
export function isDiagnosticEnabled(expectedSha256Hex: string | undefined): boolean {
  return Boolean(expectedSha256Hex && SHA256_HEX.test(expectedSha256Hex));
}

export function isAuthorizedDiagnosticRequest(
  authorizationHeader: string | null,
  expectedSha256Hex: string | undefined,
): boolean {
  if (!isDiagnosticEnabled(expectedSha256Hex) || !authorizationHeader) {
    return false;
  }
  const match = /^Bearer ([^\s]+)$/.exec(authorizationHeader);
  if (!match) {
    return false;
  }
  const presented = createHash("sha256").update(match[1], "utf8").digest();
  const expected = Buffer.from(expectedSha256Hex as string, "hex");
  return timingSafeEqual(presented, expected);
}
