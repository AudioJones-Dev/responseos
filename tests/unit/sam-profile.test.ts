import { afterEach, expect, test, vi } from "vitest";
import { readDemoKnowledge } from "@/lib/grok/demoKnowledge";
import { samDisclosurePrefix } from "@/lib/grok/samDisclosure";
import { SAM_GREETING, SAM_PROFILE } from "@/lib/grok/samProfile";
import { qualificationConfigHash } from "@/lib/grok/qualification";
import { knowledgeFixture } from "../knowledgeFixture";
import { qualificationFixture } from "../qualificationFixture";

const cleanups: (() => void)[] = [];
afterEach(() => { cleanups.splice(0).reverse().forEach(cleanup => cleanup()); vi.unstubAllEnvs(); });
function fixture() {
  const q = qualificationFixture(), k = knowledgeFixture(q.policy.accountId, SAM_PROFILE);
  cleanups.push(q.cleanup, k.cleanup);
  q.policy.knowledge = k.binding; q.policy.configSha256 = qualificationConfigHash(); q.save();
  return { q, k, capture: { account_id: q.policy.accountId, assignment_id: q.policy.assignmentId } };
}
test("Sam is explicitly packet-selected and preserves the generic knowledge voice", () => {
  const { k, capture } = fixture();
  const sam = readDemoKnowledge(capture.account_id)!;
  expect(sam.voice).toBe("ara");
  expect(sam.instructions).toContain("You are Sam");
  expect(sam.instructions).toContain("No tools are available");
  delete k.packet.agentProfile; k.save();
  const generic = readDemoKnowledge(capture.account_id)!;
  expect(generic.voice).toBe("eve");
  expect(generic.instructions).not.toContain("You are Sam");
  expect(generic.instructionsSha256).not.toBe(sam.instructionsSha256);
});
test("unknown profile or freeform voice cannot enter the trusted packet", () => {
  const { k, capture } = fixture();
  k.save({ ...k.packet, agentProfile: "unapproved" });
  expect(() => readDemoKnowledge(capture.account_id)).toThrow("unqualified");
  k.save({ ...k.packet, voice: "custom" });
  expect(() => readDemoKnowledge(capture.account_id)).toThrow("unqualified");
});
test("pre-consent carrier prefix requires exact tenant, assignment, packet and fresh qualification", async () => {
  const { q, k, capture } = fixture();
  expect(await samDisclosurePrefix(capture)).toBe(SAM_GREETING + " ");
  await expect(samDisclosurePrefix({ ...capture, account_id: "other" })).rejects.toThrow("unqualified");
  await expect(samDisclosurePrefix({ ...capture, assignment_id: "other" })).rejects.toThrow("unqualified");
  k.packet.facts[0].statement = "Changed synthetic knowledge"; k.save();
  await expect(samDisclosurePrefix(capture)).rejects.toThrow("unqualified");
  q.policy.knowledge = k.save(); q.policy.configSha256 = qualificationConfigHash(); q.save();
  vi.stubEnv("RESPONSEOS_QUALIFICATION_ACTIVATION", "DISABLED");
  await expect(samDisclosurePrefix(capture)).rejects.toThrow("unqualified");
});
test("no Sam prefix leaks into non-Grok or generic baseline calls", async () => {
  const { k, capture } = fixture();
  vi.stubEnv("RESPONSEOS_VOICE_ENGINE", "telnyx");
  expect(await samDisclosurePrefix(capture)).toBe("");
  vi.stubEnv("RESPONSEOS_VOICE_ENGINE", "grok-voice-3.0");
  delete k.packet.agentProfile; k.save();
  expect(await samDisclosurePrefix(capture)).toBe("");
});
