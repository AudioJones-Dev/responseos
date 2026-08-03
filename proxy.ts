import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { clerkMiddleware } from "@clerk/nextjs/server";
import { isPublicPath } from "@/lib/auth/route-protection";
import { isAuthRequired } from "@/lib/auth/auth-required";

/**
 * Clerk route-protection seam (32C). When Clerk is configured
 * (`CLERK_SECRET_KEY` present), `clerkMiddleware` runs at the edge and
 * enforces sign-in on every non-public route; `auth()` in
 * `lib/auth/session.ts` then derives the session. Public routes
 * (`lib/auth/route-protection.ts`) stay open — including `/api/webhooks/*`,
 * which self-validate signatures per ADR-0009.
 *
 * When Clerk is absent the proxy is a pass-through: the app boots and runs on
 * the placeholder dev-session (ADR-0001 mock-first), exactly as before 32C.
 */
const clerkProxy = clerkMiddleware(async (auth, req) => {
  if (!isPublicPath(req.nextUrl.pathname)) {
    await auth.protect();
  }
});

export default function proxy(req: NextRequest, event: NextFetchEvent) {
  if (!process.env.CLERK_SECRET_KEY) {
    // Auth-required deploy with no Clerk configuration: nothing can
    // authenticate, so protected surfaces must not be reachable at all.
    // `getCurrentSession` already fails closed here, which renders empty
    // shells; stopping the request at the edge is the layer that actually
    // keeps anonymous visitors off the operator and tenant consoles.
    if (isAuthRequired() && !isPublicPath(req.nextUrl.pathname)) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }
  return clerkProxy(req, event);
}

export const config = {
  matcher: [
    // Run on everything except Next internals and static asset files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
    // Always run on API/webhook routes.
    "/(api)(.*)",
  ],
};
