import { Appointments } from "@/lib/data";
import { respondWithResult } from "@/lib/providers/webhook-helpers";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return respondWithResult(await Appointments.getAppointmentById(id));
}
