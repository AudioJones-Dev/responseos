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

const SHA256_HEX = /^[0-9a-f]{64}$/;

// Deliberately stricter than WHATWG URL parsing, which resolves dot segments
// and lets an unencoded `/`, `?` or `#` in a password move the host boundary.
// The value must contain exactly one `@`, and it must sit inside the
// authority (before the first `/`, `?` or `#`). The host is read only from
// after that `@` and the database only from one path segment after the host,
// so no part of the userinfo can reach the output. Userinfo is never decoded.
const SCHEME = /^([a-z][a-z0-9+.-]*):\/\//i;
const POSTGRES_SCHEMES = new Set(["postgres", "postgresql"]);
const HOST_PORT =
  /^(?:([a-z0-9-]+(?:\.[a-z0-9-]+)+)|(\[[0-9a-f:.]+\]))(?::([0-9]{1,5}))?$/i;
const FORBIDDEN_CHARACTERS = /[\x00-\x20\x7f]/;

const UNPARSEABLE: DatabaseTarget = { status: "unparseable", hostname: null, database: null };

export function describeDatabaseTarget(value: string | undefined): DatabaseTarget {
  if (!value) {
    return { status: "missing", hostname: null, database: null };
  }

  const raw = value.trim();
  const scheme = SCHEME.exec(raw);
  if (!scheme) {
    return UNPARSEABLE;
  }
  if (!POSTGRES_SCHEMES.has(scheme[1].toLowerCase())) {
    return { status: "unsupported_scheme", hostname: null, database: null };
  }
  if (FORBIDDEN_CHARACTERS.test(raw)) {
    return UNPARSEABLE;
  }

  const rest = raw.slice(scheme[0].length);
  const authorityEnd = rest.search(/[/?#]/);
  const authority = authorityEnd === -1 ? rest : rest.slice(0, authorityEnd);
  const tail = authorityEnd === -1 ? "" : rest.slice(authorityEnd);

  const at = authority.indexOf("@");
  if (
    at <= 0 ||
    authority.indexOf("@", at + 1) !== -1 ||
    tail.includes("@") ||
    authority.startsWith(":")
  ) {
    return UNPARSEABLE;
  }

  const hostPort = HOST_PORT.exec(authority.slice(at + 1));
  if (!hostPort || (hostPort[3] !== undefined && Number(hostPort[3]) > 65535)) {
    return UNPARSEABLE;
  }
  const hostname = hostPort[1] ?? hostPort[2];

  let database: string | null = null;
  if (tail.startsWith("/")) {
    const segment = tail.slice(1).split(/[?#]/, 1)[0];
    if (segment) {
      let decoded: string;
      try {
        decoded = decodeURIComponent(segment);
      } catch {
        return UNPARSEABLE;
      }
      if (segment.includes("/") || decoded === "." || decoded === ".." || FORBIDDEN_CHARACTERS.test(decoded)) {
        return UNPARSEABLE;
      }
      database = decoded;
    }
  }

  return { status: "ok", hostname, database };
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
