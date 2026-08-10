import "@/lib/serverOnlyGuard";
import { db } from "@/lib/db/client";
import { getMockAgentProfiles } from "@/lib/mock/agentProfiles";
import type { AgentProfile, AgentProfileType } from "@/types/agentProfile";
import { err, errFromThrown, ok, type Result } from "./result";
import { withTenantScope } from "./session-helpers";

function rowToAgentProfile(row: {
  id: string;
  account_id: string;
  name: string;
  slug: string;
  profile_type: string;
  enabled: boolean;
  is_default: boolean;
  policy_json: unknown;
  metadata_json: unknown;
  created_at: Date;
  updated_at: Date;
}): AgentProfile {
  return {
    id: row.id,
    account_id: row.account_id,
    name: row.name,
    slug: row.slug,
    profile_type: row.profile_type as AgentProfileType,
    enabled: row.enabled,
    is_default: row.is_default,
    policy_json: row.policy_json ?? undefined,
    metadata_json: row.metadata_json ?? undefined,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export async function listAgentProfiles(params: {
  accountId?: string;
  enabled?: boolean;
}): Promise<Result<AgentProfile[]>> {
  const scope = await withTenantScope(params.accountId);
  if (!scope.ok) return err(scope.error.code, scope.error.message);

  if (db === null) {
    return ok(
      getMockAgentProfiles().filter(
        (profile) =>
          (!scope.effectiveAccountId ||
            profile.account_id === scope.effectiveAccountId) &&
          (params.enabled === undefined || profile.enabled === params.enabled),
      ),
    );
  }

  try {
    const rows = await db.agentProfile.findMany({
      where: {
        ...(scope.effectiveAccountId
          ? { account_id: scope.effectiveAccountId }
          : {}),
        ...(params.enabled === undefined ? {} : { enabled: params.enabled }),
      },
      orderBy: { created_at: "asc" },
    });
    return ok(rows.map(rowToAgentProfile));
  } catch (error) {
    return errFromThrown<AgentProfile[]>(error);
  }
}
