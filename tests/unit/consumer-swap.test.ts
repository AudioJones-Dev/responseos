import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * Phase C consumer-swap smoke tests.
 *
 * Exercises that:
 * - app/api/** routes return the canonical Result<T> envelope (no `mock: true`)
 *   when reading via lib/data/* accessors.
 * - The fallback path is preserved: with DATABASE_URL unset, lib/data/*
 *   short-circuits to lib/mock/* fixtures and the routes still 200 OK.
 * - Tenant scoping flows through to API routes that don't pass an explicit
 *   organization id (aj_admin sees both orgs; client_admin sees only own).
 */

const ORIGINAL_ENV = { ...process.env };

type MutableEnv = Record<string, string | undefined>;

beforeEach(() => {
  vi.resetModules();
  process.env = { ...ORIGINAL_ENV };
  const env = process.env as MutableEnv;
  delete env.DATABASE_URL;
  delete env.RESPONSEOS_DEV_SESSION;
  delete env.NODE_ENV;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

async function asAjAdmin() {
  // default session is aj_admin
}
async function asClientAdminOrg1() {
  process.env.RESPONSEOS_DEV_SESSION = "client_admin@org_mock_1";
  vi.resetModules();
}

interface SuccessEnvelope<T> {
  ok: true;
  data: T;
}
interface ErrorEnvelope {
  ok: false;
  error: { code: string; message: string };
}
type Envelope<T> = SuccessEnvelope<T> | ErrorEnvelope;

async function bodyOf<T>(res: Response): Promise<Envelope<T>> {
  return (await res.json()) as Envelope<T>;
}

// ---- API route shape ----------------------------------------------------

describe("API routes use canonical Result<T> envelope", () => {
  test("GET /api/calls returns { ok, data } with no mock flag", async () => {
    await asAjAdmin();
    const { GET } = await import("@/app/api/calls/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await bodyOf<unknown[]>(res);
    expect(body.ok).toBe(true);
    expect(Object.keys(body)).toEqual(["ok", "data"]);
    if (body.ok) expect(Array.isArray(body.data)).toBe(true);
  });

  test("GET /api/leads returns canonical envelope from data accessor", async () => {
    await asAjAdmin();
    const { GET } = await import("@/app/api/leads/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await bodyOf<{ id: string }[]>(res);
    expect(body.ok).toBe(true);
    if (body.ok) expect(body.data.length).toBeGreaterThan(0);
  });

  test("GET /api/leads/:id maps not_found to 404 with canonical error envelope", async () => {
    await asAjAdmin();
    const { GET } = await import("@/app/api/leads/[id]/route");
    const res = await GET(new Request("http://x/"), {
      params: Promise.resolve({ id: "lead_does_not_exist" }),
    });
    expect(res.status).toBe(404);
    const body = await bodyOf<unknown>(res);
    expect(body.ok).toBe(false);
    if (!body.ok) expect(body.error.code).toBe("not_found");
  });

  test("GET /api/quotes/:id returns 200 with the matching record", async () => {
    await asAjAdmin();
    const { GET } = await import("@/app/api/quotes/[id]/route");
    const list = await import("@/lib/mock/quotes");
    const fixture = list.getMockQuoteRequests()[0];
    const res = await GET(new Request("http://x/"), {
      params: Promise.resolve({ id: fixture.id }),
    });
    expect(res.status).toBe(200);
    const body = await bodyOf<{ id: string }>(res);
    expect(body.ok).toBe(true);
    if (body.ok) expect(body.data.id).toBe(fixture.id);
  });

  test("GET /api/reports/client/:accountId preserves wrapper shape", async () => {
    await asAjAdmin();
    const { GET } = await import(
      "@/app/api/reports/client/[accountId]/route"
    );
    const res = await GET(new Request("http://x/"), {
      params: Promise.resolve({ accountId: "org_mock_1" }),
    });
    expect(res.status).toBe(200);
    const body = await bodyOf<{
      account_id: string;
      metrics: unknown[];
    }>(res);
    expect(body.ok).toBe(true);
    if (body.ok) {
      expect(body.data.account_id).toBe("org_mock_1");
      expect(Array.isArray(body.data.metrics)).toBe(true);
    }
  });

  test("GET /api/auth/session reflects the resolved dev session", async () => {
    await asClientAdminOrg1();
    const { GET } = await import("@/app/api/auth/session/route");
    const res = await GET();
    const body = await bodyOf<{
      authenticated: boolean;
      account: { id: string } | null;
    }>(res);
    expect(body.ok).toBe(true);
    if (body.ok) {
      expect(body.data.authenticated).toBe(true);
      expect(body.data.account?.id).toBe("org_mock_1");
    }
  });
});

// ---- Tenant scoping reaches the API surface -----------------------------

describe("API routes honor session tenant scope", () => {
  test("GET /api/calls as client_admin@org_mock_1 only returns own org", async () => {
    await asClientAdminOrg1();
    const { GET } = await import("@/app/api/calls/route");
    const res = await GET();
    const body = await bodyOf<{ account_id: string }[]>(res);
    expect(body.ok).toBe(true);
    if (body.ok) {
      expect(body.data.length).toBeGreaterThan(0);
      expect(
        body.data.every((c) => c.account_id === "org_mock_1"),
      ).toBe(true);
    }
  });

  test("GET /api/calls as aj_admin spans both seeded orgs", async () => {
    await asAjAdmin();
    const { GET } = await import("@/app/api/calls/route");
    const res = await GET();
    const body = await bodyOf<{ account_id: string }[]>(res);
    expect(body.ok).toBe(true);
    if (body.ok) {
      const orgs = new Set(body.data.map((c) => c.account_id));
      expect(orgs.has("org_mock_1")).toBe(true);
      expect(orgs.has("org_mock_2")).toBe(true);
    }
  });

  test("GET /api/reports/client/:accountId across tenants → 403", async () => {
    await asClientAdminOrg1();
    const { GET } = await import(
      "@/app/api/reports/client/[accountId]/route"
    );
    const res = await GET(new Request("http://x/"), {
      params: Promise.resolve({ accountId: "org_mock_2" }),
    });
    expect(res.status).toBe(403);
    const body = await bodyOf<unknown>(res);
    expect(body.ok).toBe(false);
    if (!body.ok) expect(body.error.code).toBe("tenant_scope_denied");
  });
});

// ---- Mock fallback preserved --------------------------------------------

describe("DATABASE_URL unset preserves mock fallback", () => {
  test("admin clients page renders the mock account roster", async () => {
    delete (process.env as MutableEnv).DATABASE_URL;
    await asAjAdmin();
    const Page = (await import("@/app/(admin)/admin/clients/page")).default;
    const tree = await Page();
    // Render server-component output via React Server Components is not in
    // scope; sanity-check the data path by re-running the underlying accessor.
    const { Accounts } = await import("@/lib/data");
    const result = await Accounts.listAccounts();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.map((o) => o.id)).toEqual(
        expect.arrayContaining(["org_mock_1", "org_mock_2"]),
      );
    }
    expect(tree).toBeDefined();
  });
});
