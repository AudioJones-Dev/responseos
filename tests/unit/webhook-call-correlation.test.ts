import { beforeEach, expect, test, vi } from "vitest";
import { findCallCorrelation } from "@/lib/data/webhookEvents";

const database = vi.hoisted(() => ({ webhookEvent: { findMany: vi.fn() } }));
vi.mock("@/lib/db/client", () => ({ db: database }));
vi.mock("@/lib/auth/session", () => ({ requireRole: vi.fn() }));

const callStartedAt = new Date("2026-09-14T15:00:00.000Z");
const body = (occurredAt: Date | null) => JSON.stringify({ data: occurredAt ? { occurred_at: occurredAt.toISOString() } : {} });
const initialization = { event_type: "assistant.initialization", agent_target: "+15555550188", raw_body: body(callStartedAt) };
const hangup = { event_type: "call.hangup", agent_target: "+15555550188", raw_body: body(new Date("2026-09-14T15:04:00.000Z")) };
const params = { provider: "telnyx", providerCallIds: ["session"] };

beforeEach(() => {
  vi.resetAllMocks();
});

test("anchors to the initialization even when a direct call event was received first", async () => {
  database.webhookEvent.findMany.mockResolvedValue([hangup, initialization]);
  await expect(findCallCorrelation(params)).resolves.toEqual({ target: "+15555550188", anchoredAt: callStartedAt });
});

test("fails closed when no initialization bound the call to the number", async () => {
  database.webhookEvent.findMany.mockResolvedValue([hangup]);
  await expect(findCallCorrelation(params)).resolves.toBeNull();
});

test("fails closed when the initialization carries no signed occurred_at", async () => {
  database.webhookEvent.findMany.mockResolvedValue([{ ...initialization, raw_body: body(null) }]);
  await expect(findCallCorrelation(params)).resolves.toBeNull();
});

test("fails closed when the call's events disagree about the number", async () => {
  database.webhookEvent.findMany.mockResolvedValue([initialization, { ...hangup, agent_target: "+15555550189" }]);
  await expect(findCallCorrelation(params)).resolves.toBeNull();
});

test("reads only signed rows that carried a number for this provider's call", async () => {
  database.webhookEvent.findMany.mockResolvedValue([]);
  await findCallCorrelation({ provider: "telnyx", providerCallIds: ["control", "", "session"] });
  expect(database.webhookEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
    where: { provider: "telnyx", OR: [{ provider_call_id: { in: ["control", "session"] } }, { provider_call_ids: { hasSome: ["control", "session"] } }], agent_target: { not: null }, signature_valid: true },
  }));
});
