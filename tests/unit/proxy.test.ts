import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const m = vi.hoisted(() => ({
  clerkProxy: vi.fn(() => "CLERK_RESULT"),
  next: vi.fn(() => "NEXT_RESULT"),
  redirect: vi.fn((url: URL) => `REDIRECT:${url.pathname}`),
  captured: { handler: null as null | ((auth: unknown, req: unknown) => unknown) },
}));

vi.mock("next/server", () => ({
  NextResponse: { next: m.next, redirect: m.redirect },
}));
vi.mock("@clerk/nextjs/server", () => ({
  clerkMiddleware: vi.fn((handler: (auth: unknown, req: unknown) => unknown) => {
    m.captured.handler = handler;
    return m.clerkProxy;
  }),
}));

const ORIGINAL_ENV = { ...process.env };

async function loadProxy() {
  vi.resetModules();
  return await import("@/proxy");
}

describe("proxy.ts route protection", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    const env = process.env as Record<string, string | undefined>;
    delete env.CLERK_SECRET_KEY;
    delete env.RESPONSEOS_REQUIRE_AUTH;
    vi.clearAllMocks();
  });
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  test("Clerk absent → pass-through, no enforcement", async () => {
    const { default: proxy } = await loadProxy();
    const result = proxy({} as never, {} as never);
    expect(result).toBe("NEXT_RESULT");
    expect(m.next).toHaveBeenCalledTimes(1);
    expect(m.clerkProxy).not.toHaveBeenCalled();
  });

  test("Clerk present → delegates to clerkMiddleware", async () => {
    process.env.CLERK_SECRET_KEY = "sk_test_123";
    const { default: proxy } = await loadProxy();
    const req = {} as never;
    const event = {} as never;
    const result = proxy(req, event);
    expect(result).toBe("CLERK_RESULT");
    expect(m.clerkProxy).toHaveBeenCalledWith(req, event);
    expect(m.next).not.toHaveBeenCalled();
  });

  test("Clerk absent + RESPONSEOS_REQUIRE_AUTH → protected route redirects at the edge", async () => {
    // An auth-required deploy with no Clerk config cannot authenticate anyone,
    // so the operator/tenant consoles must not be reachable at all (D2).
    process.env.RESPONSEOS_REQUIRE_AUTH = "1";
    const { default: proxy } = await loadProxy();
    const req = {
      nextUrl: { pathname: "/client/dashboard" },
      url: "https://demo.example/client/dashboard",
    } as never;
    expect(proxy(req, {} as never)).toBe("REDIRECT:/");
    expect(m.next).not.toHaveBeenCalled();
  });

  test("Clerk absent + RESPONSEOS_REQUIRE_AUTH → public routes stay reachable", async () => {
    process.env.RESPONSEOS_REQUIRE_AUTH = "1";
    const { default: proxy } = await loadProxy();
    for (const pathname of ["/", "/pricing", "/audit", "/trust", "/demo/walkthrough"]) {
      const req = {
        nextUrl: { pathname },
        url: `https://demo.example${pathname}`,
      } as never;
      expect(proxy(req, {} as never)).toBe("NEXT_RESULT");
    }
    expect(m.redirect).not.toHaveBeenCalled();
  });

  test("RESPONSEOS_REQUIRE_AUTH=0/false keeps the mock-first pass-through", async () => {
    for (const value of ["0", "false"]) {
      process.env.RESPONSEOS_REQUIRE_AUTH = value;
      const { default: proxy } = await loadProxy();
      const req = {
        nextUrl: { pathname: "/client/dashboard" },
        url: "https://demo.example/client/dashboard",
      } as never;
      expect(proxy(req, {} as never)).toBe("NEXT_RESULT");
    }
    expect(m.redirect).not.toHaveBeenCalled();
  });

  test("Clerk present wins over RESPONSEOS_REQUIRE_AUTH", async () => {
    process.env.CLERK_SECRET_KEY = "sk_test_123";
    process.env.RESPONSEOS_REQUIRE_AUTH = "1";
    const { default: proxy } = await loadProxy();
    const req = {
      nextUrl: { pathname: "/client/dashboard" },
      url: "https://demo.example/client/dashboard",
    } as never;
    expect(proxy(req, {} as never)).toBe("CLERK_RESULT");
    expect(m.redirect).not.toHaveBeenCalled();
  });

  test("middleware handler protects non-public routes and leaves public ones open", async () => {
    await loadProxy();
    const handler = m.captured.handler!;
    expect(handler).toBeTypeOf("function");

    const protectedAuth = { protect: vi.fn() };
    await handler(protectedAuth, { nextUrl: { pathname: "/client/dashboard" } });
    expect(protectedAuth.protect).toHaveBeenCalledTimes(1);

    const publicAuth = { protect: vi.fn() };
    await handler(publicAuth, { nextUrl: { pathname: "/api/webhooks/clerk" } });
    expect(publicAuth.protect).not.toHaveBeenCalled();
  });
});
