import "@/lib/serverOnlyGuard";
import { db } from "@/lib/db/client";
import { databaseTargetDigest, loadPilotConfig } from "./config";
import { dispatchPilot, ingestPilot, purgePilotContent } from "./store";
import { telnyxPilotTransport } from "@/lib/providers/telnyx/pilot";
import type { TelnyxWebhookEnvelope } from "@/lib/providers/telnyx/webhook";
import { deletePilotArtifacts, telnyxDeletionTransport } from "./deletion";

export async function handlePilotEvent(event: TelnyxWebhookEnvelope, rawBody: string) {
  const c = loadPilotConfig();
  if (!c) {
    let applicationId: unknown;
    try { applicationId = JSON.parse(process.env.RESPONSEOS_FRL_PILOT_CONFIG ?? "null")?.applicationId; } catch { /* Invalid configuration cannot identify its application. */ }
    if (typeof applicationId === "string" && event.data.payload.connection_id === applicationId) throw new Error("pilot_configuration_unavailable");
    return { handled: false };
  }
  if (event.data.payload.connection_id !== c.applicationId) return { handled: false };
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

export async function runPilotCleanupOnce(): Promise<boolean> {
  const c = loadPilotConfig();
  const key = process.env.RESPONSEOS_FRL_PILOT_TELNYX_API_KEY;
  if (!c || !key || !db || process.env.RESPONSEOS_FRL_PILOT_CLEANUP_ENABLED !== "true" || process.env.VERCEL_ENV === "production" || process.env.RESPONSEOS_REQUIRE_AUTH !== "true" || process.env.RESPONSEOS_FRL_PILOT_DEPLOYMENT_ID !== c.deploymentId || databaseTargetDigest(process.env.DATABASE_URL) !== c.databaseTargetDigest) return false;
  return deletePilotArtifacts(db, c.accountId, telnyxDeletionTransport(key, c.applicationId));
}
