import "@/lib/serverOnlyGuard";
import { setProspectNotificationResult } from "@/lib/data/prospectIntakes";

const TIMEOUT_MS = 3_000;

export async function notifyProspectIntake(params: {
  id: string;
  reference: string;
}): Promise<void> {
  const endpoint = process.env.RESPONSEOS_AUDIT_NOTIFICATION_WEBHOOK_URL;
  if (!endpoint) {
    await setProspectNotificationResult({
      id: params.id,
      sent: false,
      error: "notification_not_configured",
    });
    return;
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reference: params.reference }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`notification_http_${response.status}`);
    await setProspectNotificationResult({ id: params.id, sent: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "notification_failed";
    await setProspectNotificationResult({
      id: params.id,
      sent: false,
      error: message.slice(0, 120),
    });
  }
}
