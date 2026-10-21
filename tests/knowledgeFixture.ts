import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { vi } from "vitest";
import { knowledgeHash } from "@/lib/grok/demoKnowledge";

export function knowledgeFixture(accountId = "synthetic-demo", agentProfile?: "frl-sam-ara-v1") {
  const directory = mkdtempSync(path.join(tmpdir(), "knowledge-test-"));
  const file = path.join(directory, "knowledge.json");
  const packet = { schemaVersion: 1, status: "approved", version: "synthetic-v1", approvalId: "synthetic-not-owner-approval", accountId,
    ...(agentProfile ? { agentProfile } : {}),
    notBefore: new Date(Date.now() - 1000).toISOString(), expiresAt: new Date(Date.now() + 60000).toISOString(),
    facts: Array.from({ length: 7 }, (_, index) => ({ id: `SYNTHETIC-${index}`, statement: `Fictional test item ${index} is blue. This is not FRL business information.` })),
  };
  vi.stubEnv("RESPONSEOS_DEMO_KNOWLEDGE_FILE", file);
  function save(value: unknown = packet) {
    const raw = JSON.stringify(value); writeFileSync(file, raw);
    const sha256 = knowledgeHash(raw); vi.stubEnv("RESPONSEOS_DEMO_KNOWLEDGE_SHA256", sha256);
    return { version: packet.version, sha256 };
  }
  const binding = save();
  return { packet, binding, file, save, cleanup: () => rmSync(directory, { recursive: true }) };
}
