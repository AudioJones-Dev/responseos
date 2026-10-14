import { expect, test, vi } from "vitest";
import { POST } from "@/app/api/admin/supervised-tenants/route";
const configure = vi.hoisted(() => vi.fn());
vi.mock("@/lib/agentExecution/supervisedTenant", () => ({ configureSupervisedTenant: configure }));
const input = { accountSlug: "fixture", businessName: "Fixture", timezone: "America/New_York", agentName: "Sam", executionMode: "SUPERVISED_PILOT", approvalRecordRef: "test", configuration: [] };
test.each([null, { ...input, accountSlug: 1 }, { ...input, approvalRecordRef: {} }, { ...input, configuration: [null] }, { ...input, number: { e164: 1 } }, { ...input, activate: "true" }])("rejects malformed configuration before service dispatch: %j", async (body) => {
  const response = await POST(new Request("https://example.test/configure", { method: "POST", body: JSON.stringify(body) }));
  expect(response.status).toBe(422);
  expect(configure).not.toHaveBeenCalled();
});
