import { afterEach, expect, test, vi } from "vitest";
import { readDemoKnowledge } from "@/lib/grok/demoKnowledge";
import { samDisclosurePrefix } from "@/lib/grok/samDisclosure";
import { SAM_GREETING, SAM_PILOT_GREETING, SAM_PILOT_PROFILE, SAM_PROFILE } from "@/lib/grok/samProfile";
import { pilotAuthorityTarget, qualificationConfigHash } from "@/lib/grok/qualification";
import { reviewMessage, type ReviewPayload } from "@/lib/callReview/contracts";
import { knowledgeFixture } from "../knowledgeFixture";
import { qualificationFixture } from "../qualificationFixture";

const cleanups: (() => void)[] = [];
afterEach(() => { cleanups.splice(0).reverse().forEach(cleanup => cleanup()); vi.unstubAllEnvs(); });

const PILOT = { mode: "carrier-pilot", crm: true, email: true, transcript: true, transcriptRetentionDays: 30 };
function fixture(options: { pilot: boolean; profile?: typeof SAM_PROFILE | typeof SAM_PILOT_PROFILE }) {
  const q = qualificationFixture(options.pilot ? PILOT : {});
  const k = knowledgeFixture(q.policy.accountId, options.profile ?? (options.pilot ? SAM_PILOT_PROFILE : SAM_PROFILE));
  cleanups.push(q.cleanup, k.cleanup);
  if (options.pilot) {
    vi.stubEnv("RESPONSEOS_LIVE_HUBSPOT_ENABLED", "true");
    vi.stubEnv("RESPONSEOS_LIVE_EMAIL_ENABLED", "true");
    vi.stubEnv("RESPONSEOS_PILOT_ACTIVATION", "ENABLED");
  }
  const reseal = () => { q.policy.knowledge = k.binding; q.policy.configSha256 = qualificationConfigHash(); q.save(); };
  reseal();
  return { q, k, reseal, capture: { account_id: q.policy.accountId, assignment_id: q.policy.assignmentId } };
}

test("the pilot packet carries live-call instructions and none of the demo's fictional-detail rules", () => {
  const { capture } = fixture({ pilot: true });
  const knowledge = readDemoKnowledge(capture.account_id)!;
  expect(knowledge.pilot).toBe(true);
  expect(knowledge.voice).toBe("ara");
  expect(knowledge.instructions).toContain("live call with a real caller");
  expect(knowledge.instructions).toContain("No tools are available");
  expect(knowledge.instructions.split("SYNTHETIC-0")[0]).not.toMatch(/fictional|made-up|demonstration/i);
  expect(SAM_PILOT_GREETING).not.toMatch(/fictional|made-up|demonstration/i);
});

test("a pilot contract admits the pilot greeting and names its target", async () => {
  const { q, capture } = fixture({ pilot: true });
  expect(await samDisclosurePrefix(capture)).toBe(SAM_PILOT_GREETING + " ");
  expect(pilotAuthorityTarget()).toEqual({ accountId: q.policy.accountId, assignmentId: q.policy.assignmentId });
});

test("the demo contract never names a pilot target", async () => {
  const { capture } = fixture({ pilot: false });
  expect(await samDisclosurePrefix(capture)).toBe(SAM_GREETING + " ");
  expect(pilotAuthorityTarget()).toBeNull();
});

test("the pilot script cannot run under demo authority, nor the demo script under pilot authority", async () => {
  const demo = fixture({ pilot: false, profile: SAM_PILOT_PROFILE });
  await expect(samDisclosurePrefix(demo.capture)).resolves.toBe("");
  expect(pilotAuthorityTarget()).toBeNull();
  cleanups.splice(0).reverse().forEach(cleanup => cleanup()); vi.unstubAllEnvs();
  const pilot = fixture({ pilot: true, profile: SAM_PROFILE });
  await expect(samDisclosurePrefix(pilot.capture)).resolves.toBe("");
  expect(pilotAuthorityTarget()).toBeNull();
});

test.each([
  ["HubSpot disabled", "RESPONSEOS_LIVE_HUBSPOT_ENABLED", "false"],
  ["email disabled", "RESPONSEOS_LIVE_EMAIL_ENABLED", "false"],
  ["activation off", "RESPONSEOS_PILOT_ACTIVATION", "DISABLED"],
])("a pilot contract fails closed with %s", (_label, name, value) => {
  const { reseal } = fixture({ pilot: true });
  vi.stubEnv(name, value);
  reseal();
  expect(pilotAuthorityTarget()).toBeNull();
});

test("demo authority fails closed while pilot activation is switched on", () => {
  const { reseal } = fixture({ pilot: false });
  vi.stubEnv("RESPONSEOS_PILOT_ACTIVATION", "ENABLED");
  reseal();
  expect(() => readDemoKnowledge("synthetic-demo")).not.toThrow();
  expect(pilotAuthorityTarget()).toBeNull();
});

test("a pilot contract cannot drop transcript retention or business-effect flags", () => {
  const { q } = fixture({ pilot: true });
  for (const change of [{ transcriptRetentionDays: 90 }, { transcript: false }, { crm: false }, { maxDurationMs: 300001 }, { knowledge: undefined }]) {
    q.save({ ...q.policy, ...change });
    expect(pilotAuthorityTarget()).toBeNull();
  }
  q.save();
  expect(pilotAuthorityTarget()).not.toBeNull();
});

test("the email to the team names a live pilot caller only for pilot reviews", () => {
  const payload: ReviewPayload = { caller: "Pat Example", phone: "+15555550100", interaction: "new_sales", product: "ramp", location: "Tampa", summary: "Wants a ramp.", qualification: "qualified", outcome: "QUALIFIED_FREE_EVALUATION", urgency: "medium", callbackWindow: "", nextAction: "Call back.", flags: [] };
  expect(reviewMessage(payload, "call-1", true).text).toContain("Supervised FRL pilot — live caller");
  expect(reviewMessage(payload, "call-1").text).toContain("fictional customer scenario");
});
