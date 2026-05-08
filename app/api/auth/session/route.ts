import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({
      ok: true,
      data: {
        authenticated: false,
        user: null,
        organization: null,
      },
    });
  }
  return NextResponse.json({
    ok: true,
    data: {
      authenticated: true,
      user: session.user,
      organization: session.organization,
    },
  });
}
