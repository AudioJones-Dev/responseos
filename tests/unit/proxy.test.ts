import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const m = vi.hoisted(() => ({
  clerkProxy: vi.fn(() => "CLERK_RESULT"),
  next: vi.fn(() => "NEXT_RESULT"),
  redirect: vi.fn(() => "REDIRECT_RESULT"),
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
    delete (process.env as Record<string, string | undefined>).CLERK_SECRET_KEY;
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

  test("Clerk absent + production → protected routes redirect to /", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    const { default: proxy } = await loadProxy();
    const req = {
      nextUrl: { pathname: "/admin/dashboard" },
      url: "https://responseos.ajdigital.app/admin/dashboard",
    } as never;
    const result = proxy(req, {} as never);
    expect(result).toBe("REDIRECT_RESULT");
    expect(m.redirect).toHaveBeenCalledTimes(1);
    expect(m.next).not.toHaveBeenCalled();
  });

  test("Clerk absent + production → public routes stay open", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    const { default: proxy } = await loadProxy();
    const req = {
      nextUrl: { pathname: "/demo" },
      url: "https://responseos.ajdigital.app/demo",
    } as never;
    const result = proxy(req, {} as never);
    expect(result).toBe("NEXT_RESULT");
    expect(m.redirect).not.toHaveBeenCalled();
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
