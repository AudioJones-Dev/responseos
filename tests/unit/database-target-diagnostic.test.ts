import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { GET } from "@/app/api/health/database-target/route";
import { describeDatabaseTarget } from "@/lib/diagnostics/database-target";

const ORIGINAL_ENV = { ...process.env };

const TOKEN = "test-operator-token-0123456789abcdef0123456789abcdef";
const TOKEN_SHA256 = createHash("sha256").update(TOKEN, "utf8").digest("hex");

// Synthetic credentials: each fragment must never appear in any response.
const USER = "synthetic_role";
const PASSWORD = "synthetic-pa55word-xyz";
const HOST = "ep-synthetic-host-a1b2c3d4-pooler.us-east-1.aws.neon.tech";
const DATABASE = "synthetic_db";
const DATABASE_URL = `postgresql://${USER}:${PASSWORD}@${HOST}:5432/${DATABASE}?sslmode=require&channel_binding=require`;
const SECRET_FRAGMENTS = [USER, PASSWORD, "5432", "sslmode", "channel_binding", DATABASE_URL];

function request(authorization?: string): Request {
  const headers = new Headers();
  if (authorization !== undefined) headers.set("authorization", authorization);
  return new Request("https://responseos.test/api/health/database-target", { headers });
}

async function bodyText(response: Response): Promise<string> {
  return await response.clone().text();
}

let consoleSpies: ReturnType<typeof vi.spyOn>[] = [];

beforeEach(() => {
  process.env.DATABASE_URL = DATABASE_URL;
  process.env.RESPONSEOS_DB_TARGET_CHECK_TOKEN_SHA256 = TOKEN_SHA256;
  process.env.VERCEL_DEPLOYMENT_ID = "dpl_synthetic";
  process.env.VERCEL_URL = "responseos-synthetic.vercel.app";
  process.env.VERCEL_ENV = "production";
  process.env.RESPONSEOS_BUILD_SHA = "abc123";
  process.env.VERCEL_GIT_COMMIT_SHA = "abc123";
  consoleSpies = (["log", "info", "warn", "error", "debug"] as const).map((method) =>
    vi.spyOn(console, method).mockImplementation(() => {}),
  );
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

describe("GET /api/health/database-target authorization", () => {
  const unauthorized: Array<[string, string | undefined]> = [
    ["no authorization header", undefined],
    ["empty header", ""],
    ["wrong token", "Bearer not-the-token"],
    ["token with wrong scheme", `Basic ${TOKEN}`],
    ["token without scheme", TOKEN],
    ["token with trailing data", `Bearer ${TOKEN} extra`],
    ["the stored digest instead of the token", `Bearer ${TOKEN_SHA256}`],
    ["a lowercase scheme", `bearer ${TOKEN}`],
    ["a comma-joined repeated header", `Bearer ${TOKEN}, Bearer ${TOKEN}`],
  ];

  test.each(unauthorized)("rejects %s with a metadata-free 404", async (_label, header) => {
    const response = await GET(request(header));
    const text = await bodyText(response);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
    expect(response.headers.get("cache-control")).toContain("no-store");
    for (const leaked of [HOST, DATABASE, "dpl_synthetic", ...SECRET_FRAGMENTS]) {
      expect(text).not.toContain(leaked);
    }
  });

  test.each([
    ["unset", undefined],
    ["empty", ""],
    ["not a sha256 hex digest", "abc"],
    ["uppercase digest", TOKEN_SHA256.toUpperCase()],
  ])("is disabled when the stored digest is %s, even with the right token", async (_label, digest) => {
    if (digest === undefined) delete process.env.RESPONSEOS_DB_TARGET_CHECK_TOKEN_SHA256;
    else process.env.RESPONSEOS_DB_TARGET_CHECK_TOKEN_SHA256 = digest;

    const response = await GET(request(`Bearer ${TOKEN}`));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
  });

  test("disabled and unauthorized responses are indistinguishable", async () => {
    const unauthorizedResponse = await GET(request("Bearer wrong"));
    delete process.env.RESPONSEOS_DB_TARGET_CHECK_TOKEN_SHA256;
    const disabledResponse = await GET(request(`Bearer ${TOKEN}`));

    expect(unauthorizedResponse.status).toBe(disabledResponse.status);
    expect(await bodyText(unauthorizedResponse)).toBe(await bodyText(disabledResponse));
    expect([...unauthorizedResponse.headers]).toEqual([...disabledResponse.headers]);
  });
});

describe("GET /api/health/database-target authorized response", () => {
  test("returns only hostname, database name, deployment and source identity", async () => {
    const response = await GET(request(`Bearer ${TOKEN}`));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      deployment_id: "dpl_synthetic",
      deployment_url: "responseos-synthetic.vercel.app",
      environment: "production",
      build_sha: "abc123",
      runtime_git_sha: "abc123",
      database_url: { status: "ok", hostname: HOST, database: DATABASE },
    });
  });

  test("redacts credentials, port and query parameters", async () => {
    const text = await bodyText(await GET(request(`Bearer ${TOKEN}`)));
    for (const leaked of SECRET_FRAGMENTS) {
      expect(text).not.toContain(leaked);
    }
  });

  test("is never cacheable", async () => {
    const response = await GET(request(`Bearer ${TOKEN}`));
    const cacheControl = response.headers.get("cache-control") ?? "";
    expect(cacheControl).toContain("no-store");
    expect(cacheControl).toContain("private");
    expect(response.headers.get("pragma")).toBe("no-cache");
  });

  test.each([
    ["missing", undefined, "missing"],
    ["not a URL", `postgresql//${USER}:${PASSWORD}@${HOST}/${DATABASE}`, "unparseable"],
    ["a non-Postgres scheme", `mysql://${USER}:${PASSWORD}@${HOST}/${DATABASE}`, "unsupported_scheme"],
    ["a bad percent-encoding", `postgresql://${USER}:${PASSWORD}@${HOST}/%E0%A4%A`, "unparseable"],
  ])("reports a %s DATABASE_URL as a fixed status with no raw error", async (_label, value, status) => {
    if (value === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = value;

    const response = await GET(request(`Bearer ${TOKEN}`));
    const body = await response.json();
    const text = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(body.database_url).toEqual({ status, hostname: null, database: null });
    for (const leaked of [HOST, DATABASE, ...SECRET_FRAGMENTS, "Invalid URL", "URIError", "TypeError"]) {
      expect(text).not.toContain(leaked);
    }
  });

  test.each([
    `postgresql://${USER}:123/${PASSWORD}@${HOST}/${DATABASE}`,
    `postgresql://${USER}:/${PASSWORD}@${HOST}/${DATABASE}`,
    `postgresql://${USER}:?${PASSWORD}@${HOST}/${DATABASE}`,
    `postgresql://${USER}:#${PASSWORD}@${HOST}/${DATABASE}`,
    `postgresql://${USER}:Sec@ret/${PASSWORD}@${HOST}/${DATABASE}`,
  ])("rejects an unencoded password delimiter instead of misreading userinfo as the host (%#)", async (value) => {
    process.env.DATABASE_URL = value;

    const response = await GET(request(`Bearer ${TOKEN}`));
    const body = await response.json();
    const text = JSON.stringify(body);

    expect(body.database_url).toEqual({ status: "unparseable", hostname: null, database: null });
    for (const leaked of [USER, PASSWORD, "ret", HOST, DATABASE]) {
      expect(text).not.toContain(leaked);
    }
  });

  test.each([
    [`postgresql://${USER}:${encodeURIComponent("p@ss/w?rd#1")}@${HOST}/${DATABASE}`, HOST],
    [`postgresql://${USER}:${PASSWORD}@[::1]:5432/${DATABASE}`, "[::1]"],
    [`POSTGRES://${USER}:${PASSWORD}@${HOST}/${DATABASE}`, HOST],
  ])("still reads well-formed URLs (%#)", (value, hostname) => {
    expect(describeDatabaseTarget(value)).toEqual({ status: "ok", hostname, database: DATABASE });
  });

  test("writes nothing to the console on any path", async () => {
    await GET(request());
    await GET(request("Bearer wrong"));
    await GET(request(`Bearer ${TOKEN}`));
    process.env.DATABASE_URL = "not a url";
    await GET(request(`Bearer ${TOKEN}`));

    for (const spy of consoleSpies) {
      expect(spy).not.toHaveBeenCalled();
    }
  });
});

describe("database-target diagnostic isolation", () => {
  const sources = [
    "app/api/health/database-target/route.ts",
    "lib/diagnostics/database-target.ts",
  ].map((file) => readFileSync(path.join(process.cwd(), file), "utf8"));

  test("never imports the database client, Prisma or a logger", () => {
    for (const source of sources) {
      expect(source).not.toMatch(/@\/lib\/db|@prisma|prisma|from "pg"|console\./);
    }
  });

  test("hostname parsing drops userinfo for a URL with no password", () => {
    expect(describeDatabaseTarget(`postgres://${USER}@${HOST}/${DATABASE}`)).toEqual({
      status: "ok",
      hostname: HOST,
      database: DATABASE,
    });
  });
});

describe("describeDatabaseTarget strict parsing", () => {
  const DOTTED_USER = "app.synthetic";
  const SECRET = "S3cretPw";
  const UNPARSEABLE = { status: "unparseable", hostname: null, database: null };

  test.each([
    // dot segments would erase the misplaced "@" under WHATWG parsing
    `postgres://${DOTTED_USER}:1/${SECRET}/x@db.example.com/../neondb`,
    `postgres://${DOTTED_USER}:/${SECRET}/x@db.example.com/../neondb`,
    `postgres://${DOTTED_USER}:1/${SECRET}/x@db.example.com/%2e%2e/neondb`,
    `postgres://${DOTTED_USER}:1/${SECRET}/x@db.example.com/.%2E/neondb`,
    `postgres://postgres.abcref:12345/${SECRET}@aws-0-us-east-1.pooler.supabase.com:6543/../postgres`,
    // no "@": the username would be read as the host
    `postgres://${DOTTED_USER}:12345/${SECRET}`,
    `postgres://${DOTTED_USER}.example.com/${SECRET}`,
    // an "@" after the host: the text after it may be password
    `postgres://u:p@db.example.com/x@y.example.com`,
    `postgres://u:p@db.example.com?x@y`,
    `postgres://u:p@db.example.com#x@y`,
    // more than one "@"
    `postgres://${DOTTED_USER}:${SECRET}@x@db.example.com/neondb`,
    `postgres://${DOTTED_USER}:${SECRET}@@db.example.com/neondb`,
    // empty username, or credentials split by whitespace the URL parser would strip
    `postgres://:${SECRET}@db.example.com/neondb`,
    `postgres://${DOTTED_USER}:${SECRET}\t/x@db.example.com/neondb`,
    `postgres://${DOTTED_USER}:Sec\nret@db.example.com/neondb`,
    // database must be one plain segment
    `postgres://${DOTTED_USER}:${SECRET}@db.example.com/a/b`,
    `postgres://${DOTTED_USER}:${SECRET}@db.example.com/..`,
    `postgres://${DOTTED_USER}:${SECRET}@db.example.com/%2e`,
    // host must be a dotted name or bracketed IPv6, port at most 65535
    `postgres://${DOTTED_USER}:${SECRET}@localhost/neondb`,
    `postgres://${DOTTED_USER}:${SECRET}@db%2Eexample.com/neondb`,
    `postgres://${DOTTED_USER}:${SECRET}@db.example.com:70000/neondb`,
    `postgres://${DOTTED_USER}:${SECRET}@h1.example.com,h2.example.com/neondb`,
  ])("rejects %s", (value) => {
    const result = describeDatabaseTarget(value);
    expect(result).toEqual(UNPARSEABLE);
  });

  test("ignores query and fragment values entirely", () => {
    expect(
      describeDatabaseTarget(
        `postgres://${DOTTED_USER}:${SECRET}@db.example.com/neondb?schema=s&host=/tmp#frag`,
      ),
    ).toEqual({ status: "ok", hostname: "db.example.com", database: "neondb" });
  });

  test("trims surrounding whitespace but nothing inside", () => {
    expect(describeDatabaseTarget(`  postgres://u:p@db.example.com/neondb\n`)).toEqual({
      status: "ok",
      hostname: "db.example.com",
      database: "neondb",
    });
  });

  test("never returns a credential fragment for generated inputs", () => {
    let seed = 0x5eed;
    const random = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const pick = <T,>(items: readonly T[]) => items[Math.floor(random() * items.length)];
    const pieces = ["/", "?", "#", "@", ":", ".", "..", "%2e", "%40", "%2F", "-", "_", "1", "65535", "\t", "\n", " "];
    let counter = 0;
    const word = () => {
      let out = "";
      const length = 2 + Math.floor(random() * 6);
      for (let i = 0; i < length; i += 1) out += random() < 0.55 ? `Zq${(counter += 1)}Q` : pick(pieces);
      return out;
    };
    const hosts = ["db.example.com", "ep-a-b.us-east-1.aws.neon.tech:5432", "[::1]", "", "localhost"];
    const paths = ["/neondb", "/../neondb", "/%2e%2e/neondb", "", "/a/b", "?x=1", "#f"];

    let accepted = 0;
    for (let i = 0; i < 20000; i += 1) {
      const user = random() < 0.5 ? `app.${word()}` : word();
      const password = word();
      const value = `postgres://${user}:${password}${random() < 0.8 ? "@" : ""}${pick(hosts)}${pick(paths)}`;
      const result = describeDatabaseTarget(value);
      if (result.status !== "ok") continue;
      accepted += 1;
      // Accepted values hold exactly one "@"; the userinfo is everything
      // between "//" and it, whatever the generator meant by user/password.
      const userinfo = value.trim().slice("postgres://".length, value.trim().indexOf("@"));
      const output = `${result.hostname ?? ""} ${result.database ?? ""}`;
      for (const token of userinfo.match(/Zq[0-9]+Q/g) ?? []) {
        expect(output).not.toContain(token);
      }
    }
    expect(accepted).toBeGreaterThan(100);
  });
});
