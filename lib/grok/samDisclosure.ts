import "@/lib/serverOnlyGuard";
import { readDemoKnowledge } from "./demoKnowledge";
import { readQualification } from "./qualification";
import { SAM_GREETING } from "./samProfile";

export async function samDisclosurePrefix(capture: { account_id: string; assignment_id: string | null }) {
  if (process.env.RESPONSEOS_VOICE_ENGINE !== "grok-voice-3.0") return "";
  const knowledge = readDemoKnowledge(capture.account_id);
  if (!knowledge?.agentProfile) return "";
  const policy = await readQualification();
  if (policy.accountId !== capture.account_id || policy.assignmentId !== capture.assignment_id ||
    policy.knowledge?.sha256 !== knowledge.sha256 || policy.knowledge.version !== knowledge.version) throw Error("sam_disclosure_unqualified");
  return SAM_GREETING + " ";
}
