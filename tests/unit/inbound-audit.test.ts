import { describe, expect, test, beforeEach } from "vitest";
import {
  __resetInboundAuditMemoryForTests,
  createInboundAudit,
  INBOUND_PROSPECT_ACCOUNT_ID,
} from "@/lib/data/inboundAudits";
import { notifyInboundAudit } from "@/lib/notify/inboundAudit";

describe("inbound audit capture", () => {
  beforeEach(() => {
    __resetInboundAuditMemoryForTests();
  });

  test("createInboundAudit falls back to memory when DB is null", async () => {
    const result = await createInboundAudit({
      name: "Pat Prospect",
      email: "pat@example.com",
      business_name: "Pat HVAC",
      industry: "home_services",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.account_id).toBe(INBOUND_PROSPECT_ACCOUNT_ID);
    expect(result.data.persisted).toBe(false);
    expect(result.data.reference).toMatch(/^audit_/);
    expect(result.data.inputs.email).toBe("pat@example.com");
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
});
