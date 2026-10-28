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
