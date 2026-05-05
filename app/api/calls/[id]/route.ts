import { NextResponse } from "next/server";
import { getMockCalls } from "@/lib/mock/calls";
import { errorResponse } from "@/lib/providers/webhook-helpers";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const call = getMockCalls().find((c) => c.id === id);
  if (!call) {
    return errorResponse(404, {
      code: "not_found",
      message: `Call ${id} not found.`,
    });
  }
  return NextResponse.json({ ok: true, mock: true, data: call });
}
