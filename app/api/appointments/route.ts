import { Appointments } from "@/lib/data";
import { respondWithResult } from "@/lib/providers/webhook-helpers";

export async function GET() {
  return respondWithResult(await Appointments.listAppointments({}));
}
