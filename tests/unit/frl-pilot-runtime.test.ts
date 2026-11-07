import { afterEach, expect, test, vi } from "vitest";
vi.mock("@/lib/db/client", () => ({ db: null }));
import { handlePilotEvent } from "@/lib/communications/pilot/runtime";
import { testPilotConfig } from "../fixtures/frl-pilot";
afterEach(() => vi.unstubAllEnvs());
test("invalid pilot configuration cannot send speech content into the general webhook ledger", async () => {
  vi.stubEnv("RESPONSEOS_FRL_PILOT_CONFIG", JSON.stringify({ ...testPilotConfig(), disclosureVersion: "frl-spoken-v1" }));
  await expect(handlePilotEvent({ data: { id: "synthetic", event_type: "call.ai_gather.ended", payload: { connection_id: "pilot-application", message_history: [{ role: "user", content: "PRIVATE" }] } } }, "PRIVATE")).rejects.toThrow("pilot_configuration_unavailable");
});
test("unrelated applications remain outside the isolated pilot handler", async () => {
  vi.stubEnv("RESPONSEOS_FRL_PILOT_CONFIG", JSON.stringify({ applicationId: "pilot-application" }));
  expect(await handlePilotEvent({ data: { id: "synthetic", event_type: "call.initiated", payload: { connection_id: "other" } } }, "{}")).toEqual({ handled: false });
});
