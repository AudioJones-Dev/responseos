import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  __resetInboundAuditMemoryForTests,
  createInboundAudit,
  INBOUND_PROSPECT_ACCOUNT_ID,
} from "@/lib/data/inboundAudits";
import { notifyInboundAudit } from "@/lib/notify/inboundAudit";

describe("inbound audit capture", () => {
  const originalWebhook = process.env.AUDIT_NOTIFY_WEBHOOK;

  beforeEach(() => {
    __resetInboundAuditMemoryForTests();
    delete process.env.AUDIT_NOTIFY_WEBHOOK;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalWebhook === undefined) {
      delete process.env.AUDIT_NOTIFY_WEBHOOK;
    } else {
      process.env.AUDIT_NOTIFY_WEBHOOK = originalWebhook;
    }
  });

  test("createInboundAudit falls back to memory when DB is null", async () => {
    const result = await createInboundAudit({
      name: "Pat Prospect",
      email: "pat@example.com",
      business_name: "Pat HVAC",
      industry: "home_services",
      monthly_missed_calls: 20,
      avg_job_value_usd: 850,
      close_rate_pct: 30,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.account_id).toBe(INBOUND_PROSPECT_ACCOUNT_ID);
    expect(result.data.persisted).toBe(false);
    expect(result.data.reference).toMatch(/^audit_/);
    expect(result.data.inputs.email).toBe("pat@example.com");
    expect(result.data.inputs.close_rate_pct).toBe(30);
  });

  test("notifyInboundAudit logs without webhook", async () => {
    const created = await createInboundAudit({
      name: "Pat Prospect",
      email: "pat@example.com",
      business_name: "Pat HVAC",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const notify = await notifyInboundAudit(created.data);
    expect(notify.channel).toBe("log");
    expect(notify.notified).toBe(true);
  });

  test("notifyInboundAudit reports a successful reference-only webhook", async () => {
    process.env.AUDIT_NOTIFY_WEBHOOK = "https://notify.example/audit";
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    const created = await createInboundAudit({
      name: "Pat Prospect",
      email: "pat@example.com",
      business_name: "Pat HVAC",
      industry: "home_services",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const notify = await notifyInboundAudit(created.data, { fetchImpl });

    expect(notify).toEqual({ notified: true, channel: "webhook" });
    expect(fetchImpl).toHaveBeenCalledOnce();
    const request = fetchImpl.mock.calls[0];
    expect(request[0]).toBe("https://notify.example/audit");
    expect(JSON.parse(String(request[1]?.body))).toEqual({
      type: "inbound_audit",
      reference: created.data.reference,
      id: created.data.id,
      persisted: created.data.persisted,
      created_at: created.data.created_at,
    });
  });

  test("notifyInboundAudit isolates a non-2xx response", async () => {
    process.env.AUDIT_NOTIFY_WEBHOOK = "https://notify.example/audit";
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 503 }));
    const created = await createInboundAudit({
      name: "Pat Prospect",
      email: "pat@example.com",
      business_name: "Pat HVAC",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    await expect(notifyInboundAudit(created.data, { fetchImpl })).resolves.toEqual({
      notified: false,
      channel: "webhook",
    });
  });

  test("notifyInboundAudit times out without rejecting the capture", async () => {
    process.env.AUDIT_NOTIFY_WEBHOOK = "https://notify.example/audit";
    const fetchImpl = vi.fn<typeof fetch>((_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      }),
    );
    const created = await createInboundAudit({
      name: "Pat Prospect",
      email: "pat@example.com",
      business_name: "Pat HVAC",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    await expect(
      notifyInboundAudit(created.data, { fetchImpl, timeoutMs: 5 }),
    ).resolves.toEqual({ notified: false, channel: "webhook" });
  });

  test("notifyInboundAudit isolates a thrown network error", async () => {
    process.env.AUDIT_NOTIFY_WEBHOOK = "https://notify.example/audit";
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("network failed"));
    const created = await createInboundAudit({
      name: "Pat Prospect",
      email: "pat@example.com",
      business_name: "Pat HVAC",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    await expect(notifyInboundAudit(created.data, { fetchImpl })).resolves.toEqual({
      notified: false,
      channel: "webhook",
    });
  });

  test("POST /api/audit-requests succeeds after a notification failure", async () => {
    process.env.AUDIT_NOTIFY_WEBHOOK = "https://notify.example/audit";
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockRejectedValue(new TypeError("network failed")));
    const { POST } = await import("@/app/api/audit-requests/route");

    const response = await POST(
      new Request("http://localhost/api/audit-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Pat Prospect",
          email: "pat@example.com",
          business_name: "Pat HVAC",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: { notified: false },
    });
  });
});
