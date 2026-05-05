import { NextResponse } from "next/server";
import { getMockOrganizations } from "@/lib/mock/organizations";
import { errorResponse } from "@/lib/providers/webhook-helpers";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const o = getMockOrganizations().find((x) => x.id === id);
  if (!o) {
    return errorResponse(404, {
      code: "not_found",
      message: `Organization ${id} not found.`,
    });
  }
  return NextResponse.json({ ok: true, mock: true, data: o });
}
