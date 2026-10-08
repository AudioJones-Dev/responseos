import { afterEach, expect, test, vi } from "vitest";
import { HubSpotCrmProvider } from "@/lib/providers/crm/hubspot";

afterEach(() => vi.unstubAllGlobals());

test("qualified task assigns configured CRM owner with sanitized context", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "task-1" }), { status: 201 }));
  vi.stubGlobal("fetch", fetchMock);
  const provider = new HubSpotCrmProvider("synthetic-token");
  await provider.createFollowUpTask({ contactId: "contact", ownerId: "12345", dueAt: "2026-10-06T12:00:00Z",
    sanitizedSummary: "Ramp assessment", nextAction: "Callback required", evidenceReference: "ResponseOS qualified handoff synthetic-call" });
  const body = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(body.properties).toMatchObject({ hubspot_owner_id: "12345", hs_task_priority: "HIGH", hs_task_status: "NOT_STARTED" });
  expect(body.properties.hs_task_body).toContain("Callback required");
});

test("task recovery returns owner and rejects ambiguous evidence", async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ total: 1, results: [{ id: "task", properties: { hubspot_owner_id: "12345" } }] })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ total: 2, results: [{ id: "one" }, { id: "two" }] })));
  vi.stubGlobal("fetch", fetchMock);
  const provider = new HubSpotCrmProvider("synthetic-token");
  expect(await provider.findFollowUpTask("synthetic-evidence")).toEqual({ providerTaskId: "task", ownerId: "12345" });
  await expect(provider.findFollowUpTask("synthetic-evidence")).rejects.toThrow("ambiguous_activity_match");
});

test("task owner readback uses the actual provider task ID", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "task-1", properties: { hubspot_owner_id: "12345" } })));
  vi.stubGlobal("fetch", fetchMock);
  const provider = new HubSpotCrmProvider("synthetic-token");
  expect(await provider.getFollowUpTaskOwner("task-1")).toBe("12345");
  expect(fetchMock.mock.calls[0][0]).toBe("https://api.hubapi.com/crm/v3/objects/tasks/task-1?properties=hubspot_owner_id");
});
