import { BusinessMemorySnapshotSchema } from "@/lib/prospectBootstrap/contracts";
import { readOperatingConfigurationValue } from "@/lib/agentExecution/operatingConfiguration";
import type { Prisma } from "@prisma/client";
import "@/lib/serverOnlyGuard";
import { db } from "@/lib/db/client";
import type { TelnyxWebhookEnvelope } from "@/lib/providers/telnyx/webhook";

export function metadataOnly(event: TelnyxWebhookEnvelope): TelnyxWebhookEnvelope {
  const payload: Record<string, unknown> = {};
  // Every correlation and duration key the Telnyx helpers accept, so a
  // metadata-only event still correlates and still carries its duration.
  for (const key of ["call_control_id", "call_session_id", "conversation_id", "call_leg_id", "to", "start_time", "end_time", "duration_sec", "duration_secs", "duration_seconds"]) {
    const value = event.data.payload[key];
    if (typeof value === "string" || typeof value === "number") payload[key] = value;
  }
  return { data: { id: event.data.id, event_type: event.data.event_type, occurred_at: event.data.occurred_at, payload } };
}

export function consentAllowsCapture(events: { action: string; occurred_at: Date }[], startedAt: Date, endedAt: Date): boolean {
  if (!Number.isFinite(startedAt.getTime()) || !Number.isFinite(endedAt.getTime()) || endedAt < startedAt) return false;
  const ordered = [...events].sort((a, b) => a.occurred_at.getTime() - b.occurred_at.getTime());
  const before = ordered.filter((event) => event.occurred_at <= startedAt);
  return before.at(-1)?.action === "grant" && !ordered.some((event) => event.action !== "grant" && event.occurred_at >= startedAt && event.occurred_at <= endedAt);
}

export async function canRetainCallContent(accountId: string, providerCallId: string, event: TelnyxWebhookEnvelope, client = db as Prisma.TransactionClient | null) {
  if (!client) return false;
  const session = await client.callCaptureSession.findUnique({ where: { account_id_provider_call_id: { account_id: accountId, provider_call_id: providerCallId } } });
  if (!session) return false;
  const memory = BusinessMemorySnapshotSchema.safeParse(session.snapshot_json);
  if (!memory.success || !readOperatingConfigurationValue(memory.data, "policy.consent")?.transcription.enabled) return false;
  // A cumulative transcript is safe only if its entire interval is authorized.
  // The provider transport must supply these bounds; the event receipt time is not a substitute.
  const start = event.data.payload.capture_started_at;
  const end = event.data.payload.capture_ended_at;
  if (typeof start !== "string" || typeof end !== "string") return false;
  if (new Date(end).getTime() > Date.now()) return false;
  const events = await client.callConsentEvent.findMany({ where: { account_id: accountId, provider_call_id: providerCallId, artifact: "transcript" }, orderBy: { occurred_at: "asc" } });
  if (events.at(-1)?.action !== "grant") return false;
  return consentAllowsCapture(events, new Date(start), new Date(end));
}

export async function withCaptureLock<T>(accountId: string, providerCallId: string, run: (client: Prisma.TransactionClient) => Promise<T>) {
  if (!db) throw new Error("database_unavailable");
  return db.$transaction(async (client) => {
    await client.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"capture:" + accountId + ":" + providerCallId}))`;
    return run(client);
  }, { timeout: 15_000 });
}
