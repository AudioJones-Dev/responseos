import "@/lib/serverOnlyGuard";
import { db } from "@/lib/db/client";
import { getMockAgentProfiles } from "@/lib/mock/agentProfiles";
import type { AgentProfile, AgentProfileType } from "@/types/agentProfile";
import { err, errFromThrown, ok, type Result } from "./result";
import { withTenantScope } from "./session-helpers";

interface AgentProfileRow {
  id: string;
  account_id: string;
  name: string;
  slug: string;
  type: string;
  enabled: boolean;
  is_default: boolean;
  system_policy_json: unknown;
  metadata_json: unknown;
  created_at: Date;
  updated_at: Date;
}

function rowToAgentProfile(row: AgentProfileRow): AgentProfile {
  return {
    id: row.id,
    account_id: row.account_id,
    name: row.name,
    slug: row.slug,
    type: row.type as AgentProfileType,
    enabled: row.enabled,
    is_default: row.is_default,
    system_policy_json: row.system_policy_json ?? undefined,
    metadata_json: row.metadata_json ?? undefined,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export async function listAgentProfiles(params: {
  accountId?: string;
  enabledOnly?: boolean;
}): Promise<Result<AgentProfile[]>> {
  const scope = await withTenantScope(params.accountId);
  if (!scope.ok) return err(scope.error.code, scope.error.message);

  if (db === null) {
    let filtered = getMockAgentProfiles();
    if (scope.effectiveAccountId) {
      filtered = filtered.filter(
        (profile) => profile.account_id === scope.effectiveAccountId,
      );
    }
    if (params.enabledOnly) {
      filtered = filtered.filter((profile) => profile.enabled);
    }
    return ok(filtered);
  }

  try {
    const rows = await db.agentProfile.findMany({
      where: {
        ...(scope.effectiveAccountId
          ? { account_id: scope.effectiveAccountId }
          : {}),
        ...(params.enabledOnly ? { enabled: true } : {}),
      },
      orderBy: { slug: "asc" },
    });
    return ok(rows.map(rowToAgentProfile));
  } catch (e) {
    return errFromThrown<AgentProfile[]>(e);
  }
}
