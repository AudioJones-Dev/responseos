import { NextResponse } from "next/server";
import { getMockContacts } from "@/lib/mock/contacts";
import { errorResponse } from "@/lib/providers/webhook-helpers";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const c = getMockContacts().find((x) => x.id === id);
  if (!c) {
    return errorResponse(404, {
      code: "not_found",
      message: `Contact ${id} not found.`,
    });
  }
  return NextResponse.json({ ok: true, mock: true, data: c });
}
