import { NextResponse } from "next/server";

// TODO: replace with Clerk session lookup once CLERK_SECRET_KEY is wired.
export async function GET() {
  return NextResponse.json({
    ok: true,
    mock: true,
    data: {
      authenticated: false,
      user: null,
      organization: null,
    },
  });
}
