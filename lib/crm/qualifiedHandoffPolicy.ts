import "@/lib/serverOnlyGuard";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { BusinessMemorySnapshotSchema } from "@/lib/prospectBootstrap/contracts";
import { contentHash } from "@/lib/prospectBootstrap/memory";

export const QUALIFIED_HANDOFF_FACT_KEY = "policy.qualified_handoff";

export const QualifiedHandoffPolicySchema = z.object({
  crmOwnerId: z.string().regex(/^\d+$/),
  crmContactBaseUrl: z.url({ protocol: /^https$/ }).refine((value) => {
    const url = new URL(value);
    return ["app.hubspot.com", "app-eu1.hubspot.com"].includes(url.hostname)
      && !url.username && !url.password && !url.search && !url.hash
      && /^\/contacts\/\d+\/record\/0-1\/$/.test(url.pathname);
  }),
  notification: z.discriminatedUnion("channel", [
    z.object({ channel: z.literal("email"), recipient: z.email() }).strict(),
    z.object({ channel: z.literal("sms"), recipient: z.string().regex(/^\+[1-9]\d{7,14}$/) }).strict(),
  ]),
}).strict();

export type QualifiedHandoffPolicy = z.infer<typeof QualifiedHandoffPolicySchema>;

export function isFrlHandoffAccount(accountId: string): boolean {
  return Boolean(accountId) && accountId === process.env.RESPONSEOS_FRL_HANDOFF_ACCOUNT_ID;
}

export function isFrlHandoffEnabled(accountId: string): boolean {
  return isFrlHandoffAccount(accountId)
    && process.env.RESPONSEOS_FRL_QUALIFIED_HANDOFF_ENABLED === "true";
}

export async function resolveQualifiedHandoffPolicy(accountId: string) {
  const snapshotId = process.env.RESPONSEOS_FRL_HANDOFF_SNAPSHOT_ID;
  if (!db || !isFrlHandoffEnabled(accountId) || !snapshotId) return null;
  const snapshot = await db.businessMemorySnapshot.findFirst({
    where: { id: snapshotId, account_id: accountId, status: "approved", revoked_at: null },
  });
  if (!snapshot || !snapshot.approved_by || !snapshot.approved_at) return null;
  const parsed = BusinessMemorySnapshotSchema.safeParse(snapshot.memory_json);
  if (!parsed.success || parsed.data.accountId !== accountId
    || parsed.data.conflicts.length || contentHash(snapshot.memory_json) !== snapshot.content_hash) return null;
  const facts = parsed.data.policies.filter((fact) => fact.key === QUALIFIED_HANDOFF_FACT_KEY);
  if (facts.length !== 1 || facts[0].status === "operator_approved_for_demo") return null;
  const policy = QualifiedHandoffPolicySchema.safeParse(facts[0].value);
  return policy.success
    ? { policy: policy.data, snapshotId: snapshot.id, configHash: snapshot.content_hash }
    : null;
}
