import { readClientSetup } from "@/lib/clientSetup/service";
import { setupResponse } from "@/lib/clientSetup/http";

export async function GET() {
  return setupResponse(await readClientSetup());
}
