import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { AuditLogs } from "@/lib/data";
import {
  connectTestDb,
  resetTestDb,
  seedTestDb,
} from "./setup";

beforeAll(async () => {
  await connectTestDb();
});

beforeEach(async () => {
  process.env.RESPONSEOS_DEV_SESSION = "aj_admin";
  await resetTestDb();
  seedTestDb();
});

afterAll(() => {
  delete process.env.RESPONSEOS_DEV_SESSION;
});

test("recordAuditLog emits an AuditLog row with the documented shape", async () => {
  const result = await AuditLogs.recordAuditLog({
    organization_id: "org_mock_1",
    actor_user_id: "user_aj_admin_1",
    actor_type: "user",
    action: "lead.status_changed",
    target_type: "LeadEvent",
    target_id: "lead_mock_2",
    metadata_json: { from: "new", to: "qualified" },
    ip_address: "127.0.0.1",
    user_agent: "vitest",
  });

  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.data.recorded).toBe(true);

  const logs = await AuditLogs.listAuditLogs({
    organizationId: "org_mock_1",
    action: "lead.status_changed",
    limit: 1,
  });

  expect(logs.ok).toBe(true);
  if (!logs.ok) return;
  expect(logs.data[0]).toMatchObject({
    organization_id: "org_mock_1",
    actor_user_id: "user_aj_admin_1",
    actor_type: "user",
    action: "lead.status_changed",
    target_type: "LeadEvent",
    target_id: "lead_mock_2",
    metadata_json: { from: "new", to: "qualified" },
    ip_address: "127.0.0.1",
    user_agent: "vitest",
  });
  expect(logs.data[0]?.id).toMatch(/^c/);
  expect(logs.data[0]?.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
});
