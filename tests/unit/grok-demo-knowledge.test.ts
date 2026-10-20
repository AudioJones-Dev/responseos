import { writeFileSync } from "node:fs";
import { afterEach, expect, test, vi } from "vitest";
import { readDemoKnowledge, unknownKnowledgeAnswer } from "@/lib/grok/demoKnowledge";
import { readQualification, qualificationConfigHash } from "@/lib/grok/qualification";
import { knowledgeFixture } from "../knowledgeFixture";
import { qualificationFixture } from "../qualificationFixture";

const cleanups: (() => void)[] = [];
afterEach(() => { cleanups.splice(0).reverse().forEach(cleanup => cleanup()); vi.unstubAllEnvs(); });
function fixture() { const f = knowledgeFixture(); cleanups.push(f.cleanup); return f; }
test("synthetic approved-only packet produces deterministic bounded instructions", () => {
  const f = fixture(), first = readDemoKnowledge(f.packet.accountId)!;
  expect(readDemoKnowledge(f.packet.accountId)).toEqual(first);
  expect(first.instructions).toContain(unknownKnowledgeAnswer);
  expect(first.instructions).toContain(first.sha256);
  expect(first.instructions).not.toMatch(/https?:\/\//);
  expect(first.instructions).toContain("No tools are available");
});
test.each(["draft", "tenant", "future", "expired", "long-window", "link", "extra", "duplicate", "six-facts"])("rejects %s packet", change => {
  const f = fixture();
  const packet = structuredClone(f.packet);
  if (change === "draft") packet.status = "draft";
  if (change === "tenant") packet.accountId = "other";
  if (change === "future") packet.notBefore = new Date(Date.now() + 10000).toISOString();
  if (change === "expired") packet.expiresAt = new Date(0).toISOString();
  if (change === "long-window") packet.expiresAt = new Date(Date.now() + 7200000).toISOString();
  if (change === "link") packet.facts[0].statement = "See https://private.invalid";
  if (change === "duplicate") packet.facts[1].id = packet.facts[0].id;
  if (change === "six-facts") packet.facts.pop();
  f.save(change === "extra" ? { ...packet, customerRecords: [] } : packet);
  expect(() => readDemoKnowledge("synthetic-demo")).toThrow("unqualified");
});
test("missing file/hash, tampering and time expiry fail closed", () => {
  const f = fixture();
  writeFileSync(f.file, "{}");
  expect(() => readDemoKnowledge("synthetic-demo")).toThrow("unqualified");
  f.save(); vi.stubEnv("RESPONSEOS_DEMO_KNOWLEDGE_SHA256", undefined);
  expect(() => readDemoKnowledge("synthetic-demo")).toThrow("unqualified");
  f.save(); vi.stubEnv("RESPONSEOS_DEMO_KNOWLEDGE_FILE", undefined);
  expect(() => readDemoKnowledge("synthetic-demo")).toThrow("unqualified");
  vi.stubEnv("RESPONSEOS_DEMO_KNOWLEDGE_FILE", f.file);
  expect(() => readDemoKnowledge("synthetic-demo", Date.parse(f.packet.expiresAt))).toThrow("unqualified");
});
test("trusted qualification binds knowledge; missing, changed or unsolicited payload cannot admit", async () => {
  const q = qualificationFixture(); cleanups.push(q.cleanup);
  const k = fixture();
  q.policy.knowledge = k.binding; q.policy.configSha256 = qualificationConfigHash(); q.save();
  expect((await readQualification()).knowledge).toEqual(k.binding);
  k.packet.facts[0].statement = "Changed synthetic fact."; k.save();
  await expect(readQualification()).rejects.toThrow("unqualified");
  vi.stubEnv("RESPONSEOS_DEMO_KNOWLEDGE_FILE", undefined); vi.stubEnv("RESPONSEOS_DEMO_KNOWLEDGE_SHA256", undefined);
  q.policy.configSha256 = qualificationConfigHash(); q.save();
  await expect(readQualification()).rejects.toThrow("unqualified");
  delete q.policy.knowledge; k.save(); vi.stubEnv("RESPONSEOS_DEMO_KNOWLEDGE_FILE", k.file);
  q.policy.configSha256 = qualificationConfigHash(); q.save();
  await expect(readQualification()).rejects.toThrow("unqualified");
});
