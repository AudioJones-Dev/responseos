import "@/lib/serverOnlyGuard";
import { db } from "@/lib/db/client";
import { loadPilotConfig } from "./config";
import { dispatchPilot, ingestPilot, purgePilotContent } from "./store";
import { telnyxPilotTransport } from "@/lib/providers/telnyx/pilot";
import type { TelnyxWebhookEnvelope } from "@/lib/providers/telnyx/webhook";

export async function handlePilotEvent(event: TelnyxWebhookEnvelope, rawBody: string) {
  const c = loadPilotConfig();
  if (!c || event.data.payload.connection_id !== c.applicationId) return { handled: false };
  if (!db) throw new Error("pilot_database_unavailable");
  return ingestPilot(db, c, event, rawBody);
}
export async function runPilotWorkerOnce(): Promise<boolean> {
  const c = loadPilotConfig();
  const key = process.env.RESPONSEOS_FRL_PILOT_TELNYX_API_KEY;
  if (!c || !db) return false;
  await purgePilotContent(db, c);
  if (!key || process.env.RESPONSEOS_FRL_PILOT_WORKER_ENABLED !== "true") return false;
  return dispatchPilot(db, c, telnyxPilotTransport(key));
}
