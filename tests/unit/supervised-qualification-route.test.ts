import { beforeEach, expect, test, vi } from "vitest";
import { POST } from "@/app/api/admin/supervised-tenants/qualification/route";

const mocks = vi.hoisted(() => ({ start: vi.fn(), end: vi.fn() }));
vi.mock("@/lib/agentExecution/supervisedQualification", () => ({
  startSupervisedQualification: mocks.start,
  endSupervisedQualification: mocks.end,
}));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.start.mockResolvedValue({ ok: true, data: { status: "qualification" } });
  mocks.end.mockResolvedValue({ ok: true, data: { status: "qualification", ended: true } });
});

test("dispatches only a complete qualification start request", async () => {
  const body = {
    action: "start",
    accountSlug: "florida-ramp-lift",
    providerNumberId: "number-1",
    e164: "+19548720843",
    providerAssistantId: "assistant-1",
    approvalRecordRef: "owner:packet-3",
  };
  const response = await POST(new Request("https://example.test/qualification", { method: "POST", body: JSON.stringify(body) }));
  expect(response.status).toBe(200);
  expect(mocks.start).toHaveBeenCalledWith(body);
  expect(mocks.end).not.toHaveBeenCalled();
});

test("dispatches only a complete qualification end request", async () => {
  const body = { action: "end", accountSlug: "florida-ramp-lift", e164: "+19548720843", reason: "Evidence collected." };
  const response = await POST(new Request("https://example.test/qualification", { method: "POST", body: JSON.stringify(body) }));
  expect(response.status).toBe(200);
  expect(mocks.end).toHaveBeenCalledWith(body);
  expect(mocks.start).not.toHaveBeenCalled();
});

test.each([
  null,
  { action: "start", accountSlug: "frl" },
  { action: "end", accountSlug: "frl", e164: "+19548720843", reason: "" },
  { action: "activate", accountSlug: "frl" },
])("rejects malformed qualification input: %j", async (body) => {
  const response = await POST(new Request("https://example.test/qualification", { method: "POST", body: JSON.stringify(body) }));
  expect(response.status).toBe(422);
  expect(mocks.start).not.toHaveBeenCalled();
  expect(mocks.end).not.toHaveBeenCalled();
});
