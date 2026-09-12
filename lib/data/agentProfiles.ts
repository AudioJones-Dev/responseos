import "@/lib/serverOnlyGuard";
import { db } from "@/lib/db/client";
import { getMockAgentProfiles } from "@/lib/mock/agentProfiles";
import { INTERNAL_DEMO_ACCOUNT_ID } from "@/lib/tenancy/internalDemo";
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

/**
 * The internal demo tenant's agent profiles, for the public surface
 * that has no session (ADR-0052).
 *
 * This is the only accessor in `lib/data` that does not call
 * `withTenantScope`, and it does not weaken the rule it sits beside.
 * `withTenantScope` exists to stop a caller *naming* a tenant it has no
 * claim to, and it does that by deriving the account from the session.
 * A public page has no session to derive from, so the account is fixed
 * at compile time instead — this function takes no parameters, so there
 * is no argument to poison. Nothing a request carries can reach the
 * `where` clause below.
 *
 * Callers must fail closed on an error envelope: a failed query means
 * the stored policy is unknown, and the strict default
 * (`DEFAULT_AGENT_PROFILE_POLICY`, which permits no assets) is the safe
 * reading. Falling back to the fixtures on error would reintroduce
 * exactly the drift this accessor exists to remove.
 *
 * The `db === null` branch is different, and is the mock-first rule
 * (ADR-0001), not a failure: with no database configured there is no
 * stored policy to honour and the fixtures *are* the configuration.
 */
export async function listInternalDemoAgentProfiles(): Promise<
  Result<AgentProfile[]>
> {
  if (db === null) {
    return ok(
      getMockAgentProfiles().filter(
        (profile) => profile.account_id === INTERNAL_DEMO_ACCOUNT_ID,
      ),
    );
  }

  try {
    const rows = await db.agentProfile.findMany({
      where: { account_id: INTERNAL_DEMO_ACCOUNT_ID },
      orderBy: { slug: "asc" },
    });
    return ok(rows.map(rowToAgentProfile));
  } catch (e) {
    return errFromThrown<AgentProfile[]>(e);
  }
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
