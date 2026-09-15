import { describe, expect, test } from "vitest";

import { POST } from "@/app/api/leads/[id]/qualify/route";

const params = Promise.resolve({ id: "lead_test_001" });

function post(body: unknown): Promise<Response> {
  return POST(
    new Request("http://localhost/api/leads/lead_test_001/qualify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params },
  );
}

describe("POST /api/leads/:id/qualify", () => {
  test("rejects a body missing urgency with 400 instead of scoring NaN", async () => {
    const response = await post({ serviceAreaMatch: true });
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("validation_failed");
    expect(json.error.details.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: ["urgency"] })]),
    );
  });

  test("rejects an urgency value outside the scorer enum", async () => {
    const response = await post({ serviceAreaMatch: true, urgency: "asap" });
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("validation_failed");
  });

  test("scores a valid body and keeps the mock envelope", async () => {
    const response = await post({
      serviceAreaMatch: true,
      urgency: "high",
      decisionMaker: true,
      budgetTimeline: "within_30_days",
      serviceRequested: "roof repair",
      qualification_score: 999,
    });
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(json.mock).toBe(true);
    expect(json.data.lead_event_id).toBe("lead_test_001");
    expect(json.data.qualification_score).toBe(96);
  });
});
