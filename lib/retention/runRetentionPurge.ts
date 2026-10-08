import "@/lib/serverOnlyGuard";
import type { Result } from "@/lib/data/result";
import { purgeExpiredUnqualifiedProspectPii } from "@/lib/data/prospectIntakes";
import { purgeExpiredWebhookPayloads, purgeUnexpiringClerkPayloads } from "@/lib/data/webhookEvents";
import {
  cleanupExpiredProspectBootstraps,
  expireDueProspectBootstraps,
  purgeExpiredProspectContent,
  releaseQuarantinedAssignments,
} from "@/lib/prospectBootstrap/service";
import { purgeExpiredDemoCallContent } from "./demoCallContent";
import type { RetentionPurgeMode } from "./purgePolicy";

export type RetentionSweepKey =
  | "intake_pii"
  | "bootstrap_expiry"
  | "bootstrap_content"
  | "bootstrap_cleanup"
  | "number_quarantine"
  | "webhook_payloads"
  | "demo_call_content"
  | "clerk_payloads";

export interface RetentionSweepReport {
  key: RetentionSweepKey;
  label: string;
  unit: string;
  count: number;
  details: Record<string, number>;
  skipped?: string;
}

export interface RetentionPurgeReport {
  mode: RetentionPurgeMode;
  now: Date;
  sweeps: RetentionSweepReport[];
  failure?: { key: RetentionSweepKey; code: string; message: string };
}

interface Sweep {
  key: RetentionSweepKey;
  label: string;
  unit: string;
  skipped?: string;
  run: (preview: boolean) => Promise<Result<{ count: number; details: Record<string, number> }>>;
}

function primary<T extends Record<string, number>>(
  result: Result<T>,
  key: keyof T & string,
): Result<{ count: number; details: Record<string, number> }> {
  if (!result.ok) return result;
  const { [key]: count, ...details } = result.data;
  return { ok: true, data: { count, details } };
}

/**
 * Runs every retention sweep in a fixed order. Preview counts each sweep
 * against the current state and writes nothing; in apply, an earlier sweep can
 * already have handled rows a later sweep previewed, so apply counts can be
 * lower than the preview's.
 */
export async function runRetentionPurge(params: {
  mode: RetentionPurgeMode;
  now?: Date;
  inboundAccountId?: string;
  demoAccountId?: string;
}): Promise<RetentionPurgeReport> {
  const now = params.now ?? new Date();
  const { inboundAccountId, demoAccountId } = params;
  const sweeps: Sweep[] = [
    {
      key: "intake_pii",
      label: "Unqualified assessment requests (90 days)",
      unit: "requests",
      skipped: inboundAccountId ? undefined : "RESPONSEOS_INBOUND_ACCOUNT_ID is not set",
      run: async (preview) => primary(
        await purgeExpiredUnqualifiedProspectPii({ accountId: inboundAccountId!, now, preview }),
        "purged",
      ),
    },
    {
      key: "bootstrap_expiry",
      label: "Personalized demo expiry",
      unit: "bootstraps",
      run: async (preview) => primary(await expireDueProspectBootstraps(now, { preview }), "expired"),
    },
    {
      key: "bootstrap_content",
      label: "Personalized demo content (30 days)",
      unit: "bootstraps",
      run: async (preview) => primary(await purgeExpiredProspectContent(now, { preview }), "bootstraps"),
    },
    {
      key: "bootstrap_cleanup",
      label: "Personalized demo cleanup",
      unit: "bootstraps",
      run: async (preview) => primary(await cleanupExpiredProspectBootstraps(now, { preview }), "cleaned"),
    },
    {
      key: "number_quarantine",
      label: "Demo number quarantine extension",
      unit: "assignments",
      run: async (preview) => primary(await releaseQuarantinedAssignments(now, { preview }), "extended"),
    },
    {
      key: "webhook_payloads",
      label: "Expired webhook payloads",
      unit: "payloads",
      run: async (preview) => primary(await purgeExpiredWebhookPayloads(now, { preview }), "purged"),
    },
    {
      key: "demo_call_content",
      label: "General demo call content (90 days)",
      unit: "calls",
      skipped: demoAccountId ? undefined : "RESPONSEOS_DEMO_ACCOUNT_ID is not set",
      run: async (preview) => primary(
        await purgeExpiredDemoCallContent({ accountId: demoAccountId!, now, preview }),
        "calls",
      ),
    },
    {
      key: "clerk_payloads",
      label: "Clerk payloads without an expiry (30 days)",
      unit: "payloads",
      run: async (preview) => primary(await purgeUnexpiringClerkPayloads(now, { preview }), "purged"),
    },
  ];

  const reports: RetentionSweepReport[] = [];
  for (const sweep of sweeps) {
    const base = { key: sweep.key, label: sweep.label, unit: sweep.unit };
    if (sweep.skipped) {
      reports.push({ ...base, count: 0, details: {}, skipped: sweep.skipped });
      continue;
    }
    const result = await sweep.run(params.mode === "preview");
    if (!result.ok) {
      return { mode: params.mode, now, sweeps: reports, failure: { key: sweep.key, ...result.error } };
    }
    reports.push({ ...base, ...result.data });
  }
  return { mode: params.mode, now, sweeps: reports };
}
