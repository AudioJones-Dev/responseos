import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { POST } from "@/app/api/admin/call-capture/[id]/consent/route";

const mocks = vi.hoisted(() => ({ capture: vi.fn(), lockedCapture: vi.fn(), existing: vi.fn(), upsert: vi.fn(), update: vi.fn(), effect: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ db: { callCaptureSession: { findUnique: mocks.capture } } }));
vi.mock("@/lib/callReview/service", () => ({ requireReviewOperator: async () => ({ user: { id: "operator" } }) }));
vi.mock("@/lib/callControl/service", () => ({ runOperatorConsentEffect: mocks.effect }));
vi.mock("@/lib/callReview/consent", () => ({
  withCaptureLock: async (_account: string, _call: string, run: (client: unknown) => Promise<unknown>) => {
    vi.setSystemTime(new Date("2026-09-13T12:00:10Z"));
    return run({ callCaptureSession: { findUnique: mocks.lockedCapture, update: mocks.update }, callConsentEvent: { findUnique: mocks.existing, upsert: mocks.upsert } });
  },
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-13T12:00:00Z"));
  vi.clearAllMocks();
  mocks.capture.mockResolvedValue({ id: "capture", account_id: "account", provider_call_id: "call" });
  mocks.lockedCapture.mockResolvedValue({ id: "capture", account_id: "account", provider_call_id: "call", control_state: "AI_ACTIVE", dtmf_decision: "affirmative" });
  mocks.existing.mockResolvedValue(null);
  mocks.upsert.mockImplementation(async ({ create }) => ({ id: "consent", ...create }));
  mocks.update.mockResolvedValue({});
  mocks.effect.mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());

const input = { action: "withdraw", disclosureRef: "approved-disclosure", evidenceRef: "witnessed", jurisdictionBasis: "FL two-party", eventKey: "00000000-0000-4000-8000-000000000001" };
test("timestamps a witnessed withdrawal after its wait for the capture lock", async () => {
  const response = await POST(new Request("https://example.test/consent", { method: "POST", body: JSON.stringify(input) }), { params: Promise.resolve({ id: "capture" }) });
  expect(response.status).toBe(200);
  expect((await response.json()).data.occurredAt).toBe("2026-09-13T12:00:10.000Z");
});

test("records the jurisdiction basis and a server-owned source channel", async () => {
  await POST(new Request("https://example.test/consent", { method: "POST", body: JSON.stringify({ ...input, sourceChannel: "web_form" }) }), { params: Promise.resolve({ id: "capture" }) });
  expect(mocks.upsert).not.toHaveBeenCalled();
  const response = await POST(new Request("https://example.test/consent", { method: "POST", body: JSON.stringify(input) }), { params: Promise.resolve({ id: "capture" }) });
  expect(response.status).toBe(200);
  expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ jurisdiction_basis: "FL two-party", source_channel: "call" }) }));
});

test("rejects a consent event without a jurisdiction basis", async () => {
  const missing = Object.fromEntries(Object.entries(input).filter(([key]) => key !== "jurisdictionBasis"));
  const response = await POST(new Request("https://example.test/consent", { method: "POST", body: JSON.stringify(missing) }), { params: Promise.resolve({ id: "capture" }) });
  expect(response.status).toBe(422);
  expect(mocks.upsert).not.toHaveBeenCalled();
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
