import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { POST } from "@/app/api/admin/call-capture/[id]/consent/route";

const mocks = vi.hoisted(() => ({ capture: vi.fn(), upsert: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ db: { callCaptureSession: { findUnique: mocks.capture } } }));
vi.mock("@/lib/callReview/service", () => ({ requireReviewOperator: async () => ({ user: { id: "operator" } }) }));
vi.mock("@/lib/callReview/consent", () => ({
  withCaptureLock: async (_account: string, _call: string, run: (client: unknown) => Promise<unknown>) => {
    vi.setSystemTime(new Date("2026-09-13T12:00:10Z"));
    return run({ callConsentEvent: { upsert: mocks.upsert } });
  },
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-13T12:00:00Z"));
  vi.clearAllMocks();
  mocks.capture.mockResolvedValue({ id: "capture", account_id: "account", provider_call_id: "call" });
  mocks.upsert.mockImplementation(async ({ create }) => ({ id: "consent", ...create }));
});
afterEach(() => vi.useRealTimers());

const input = { action: "withdraw", disclosureRef: "approved-disclosure", evidenceRef: "witnessed", eventKey: "00000000-0000-4000-8000-000000000001" };
test("timestamps a witnessed withdrawal after its wait for the capture lock", async () => {
  const response = await POST(new Request("https://example.test/consent", { method: "POST", body: JSON.stringify(input) }), { params: Promise.resolve({ id: "capture" }) });
  expect(response.status).toBe(200);
  expect((await response.json()).data.occurredAt).toBe("2026-09-13T12:00:10.000Z");
});

test("rejects a caller-supplied consent timestamp", async () => {
  const response = await POST(new Request("https://example.test/consent", { method: "POST", body: JSON.stringify({ ...input, occurred_at: "2020-01-01T00:00:00Z" }) }), { params: Promise.resolve({ id: "capture" }) });
  expect(response.status).toBe(422);
  expect(mocks.upsert).not.toHaveBeenCalled();
});

test("reports consent persistence failure as unavailable", async () => {
  mocks.upsert.mockRejectedValue(new Error("database_unavailable"));
  const response = await POST(new Request("https://example.test/consent", { method: "POST", body: JSON.stringify(input) }), { params: Promise.resolve({ id: "capture" }) });
  expect(response.status).toBe(503);
});
