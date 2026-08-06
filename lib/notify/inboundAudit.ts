/**
 * Optional operator notify for inbound `/audit` captures.
 * Never logs prospect PII. Uses AUDIT_NOTIFY_WEBHOOK when set; otherwise
 * logs a reference-only line (mock-safe).
 */

import type { InboundAuditRecord } from "@/lib/data/inboundAudits";

export async function notifyInboundAudit(
  record: InboundAuditRecord,
): Promise<{ notified: boolean; channel: "webhook" | "log" }> {
  const webhook = process.env.AUDIT_NOTIFY_WEBHOOK?.trim();
  if (webhook) {
    try {
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "inbound_audit",
          reference: record.reference,
          id: record.id,
          persisted: record.persisted,
          industry: record.inputs.industry ?? null,
          created_at: record.created_at,
        }),
      });
      if (!res.ok && process.env.NODE_ENV !== "test") {
        console.warn(
          `[audit-request] notify webhook non-OK status=${res.status} ref=${record.reference}`,
        );
      }
      return { notified: res.ok, channel: "webhook" };
    } catch {
      if (process.env.NODE_ENV !== "test") {
        console.warn(
          `[audit-request] notify webhook failed ref=${record.reference}`,
        );
      }
      return { notified: false, channel: "webhook" };
    }
  }

  if (process.env.NODE_ENV !== "test") {
    console.log(
      `[audit-request] capture ref=${record.reference} persisted=${record.persisted}`,
    );
  }
  return { notified: true, channel: "log" };
}
