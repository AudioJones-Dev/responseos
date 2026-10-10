import { createHash } from "node:crypto";
import fs from "node:fs";

export function validateDatabaseConnections(env, target, mode = "application") {
  const errors = [];
  if (!["application", "worker", "migration"].includes(mode)) return ["invalid_mode"];
  if (!target?.host || !target?.database || !target?.runtimeRole || !target?.migrationRole || target.runtimeRole === target.migrationRole) return ["target_contract_incomplete"];
  if (!/^ep-[a-z0-9-]+\.[a-z0-9.-]+\.neon\.tech$/.test(target.host) || target.host.split(".")[0].endsWith("-pooler")) return ["target_host_invalid"];
  if (["neondb_owner", "neon_superuser", "neon_service", "cloud_admin", "postgres"].includes(target.runtimeRole)) return ["runtime_role_elevated"];
  if (env.NODE_TLS_REJECT_UNAUTHORIZED === "0") errors.push("tls_verification_disabled");
  const parse = (key, expectedRole, pooled) => {
    let url;
    try { url = new URL(env[key]); } catch { errors.push(`${key}_missing_or_invalid`); return; }
    const expectedHost = pooled ? target.host.replace(/^(ep-[^.]+)/, "$1-pooler") : target.host;
    if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== expectedHost || decodeURIComponent(url.pathname.slice(1)) !== target.database || url.port && url.port !== "5432" || url.hash) errors.push(`${key}_target_mismatch`);
    if (decodeURIComponent(url.username) !== expectedRole || !url.password) errors.push(`${key}_role_or_password_invalid`);
    if (url.searchParams.get("sslmode") !== "require" || url.searchParams.get("sslaccept") !== "strict" || url.searchParams.has("sslcert") || url.searchParams.has("sslidentity")) errors.push(`${key}_tls_invalid`);
    const allowed = new Set(["sslmode", "sslaccept", "channel_binding", "connection_limit", "pool_timeout", "connect_timeout", "application_name", "pgbouncer"]);
    const keys = [...url.searchParams.keys()];
    if (keys.some(k => !allowed.has(k)) || new Set(keys).size !== keys.length) errors.push(`${key}_connection_options_invalid`);
  };
  if (mode !== "migration") parse("DATABASE_URL", target.runtimeRole, true);
  if (mode === "worker" && env.DIRECT_URL) errors.push("worker_migration_credential_present");
  if (mode === "migration") parse("DIRECT_URL", target.migrationRole, false);
  if (mode === "application" && env.DIRECT_URL) parse("DIRECT_URL", target.migrationRole, false);
  return errors;
}

export function migrationFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => ({
    name: e.name,
    checksum: createHash("sha256").update(fs.readFileSync(`${directory}/${e.name}/migration.sql`)).digest("hex"),
  })).sort((a, b) => a.name.localeCompare(b.name));
}

export function validateMigrationHistory(applied, expected) {
  const errors = [];
  if (applied.some(m => !m || typeof m.finished !== "boolean" || typeof m.rolled_back !== "boolean" || typeof m.name !== "string" || !m.name.trim() || typeof m.checksum !== "string" || !m.checksum.trim())) return ["migration_row_invalid"];
  const active = applied.filter(m => !m.rolled_back);
  const names = new Set();
  for (const row of active) {
    if (names.has(row.name)) errors.push("duplicate_applied_migration");
    names.add(row.name);
    const file = expected.find(m => m.name === row.name);
    if (!row.finished) errors.push("unfinished_migration");
    if (!file) errors.push("applied_migration_absent_from_repository");
    else if (file.checksum !== row.checksum) errors.push("migration_checksum_mismatch");
  }
  if (active.some((row, i) => row.name !== expected[i]?.name)) errors.push("migration_application_order_mismatch");
  const lastApplied = expected.reduce((last, m, i) => names.has(m.name) ? i : last, -1);
  if (expected.slice(0, lastApplied).some(m => !names.has(m.name))) errors.push("migration_history_gap");
  return [...new Set(errors)];
}

export function validateRestoreBindings(before, after, restoreTarget) {
  const errors = [];
  for (const snapshot of [before, after]) {
    if (!snapshot?.projectId || !snapshot.defaultBranchId || !Array.isArray(snapshot.branches) || !snapshot.branches.length || !Array.isArray(snapshot.endpoints) || !snapshot.endpoints.length || !Array.isArray(snapshot.connections) || !snapshot.connections.length) return ["binding_snapshot_incomplete"];
    for (const [list, key] of [[snapshot.branches, "id"], [snapshot.endpoints, "id"], [snapshot.connections, "service"]]) {
      if (list.some(e => !e[key]) || new Set(list.map(e => e[key])).size !== list.length) return ["binding_snapshot_ambiguous"];
    }
    if (snapshot.branches.some(b => typeof b.name !== "string" || !b.name.trim())) return ["binding_branch_name_missing"];
    if (!snapshot.branches.some(b => b.id === snapshot.defaultBranchId) || snapshot.endpoints.some(e => !snapshot.branches.some(b => b.id === e.branchId)) || snapshot.connections.some(c => !c.database || !c.role || !snapshot.endpoints.some(e => e.id === c.endpointId))) return ["binding_snapshot_invalid"];
  }
  if (before.projectId !== after.projectId || before.defaultBranchId !== after.defaultBranchId) errors.push("project_or_default_branch_changed");
  for (const b of before.branches) if (!after.branches.some(a => a.id === b.id && a.name === b.name)) errors.push("existing_branch_changed");
  for (const e of before.endpoints) if (!after.endpoints.some(a => a.id === e.id && a.branchId === e.branchId)) errors.push("existing_endpoint_binding_changed");
  const connections = s => JSON.stringify([...s.connections].sort((a,b) => a.service.localeCompare(b.service)).map(c => [c.service,c.endpointId,c.database,c.role]));
  if (connections(before) !== connections(after)) errors.push("application_connection_changed");
  if (!restoreTarget?.branchId || !restoreTarget.endpointId || before.branches.some(b => b.id === restoreTarget.branchId) || before.endpoints.some(e => e.id === restoreTarget.endpointId) || !after.endpoints.some(e => e.id === restoreTarget.endpointId && e.branchId === restoreTarget.branchId)) errors.push("restore_target_not_separate");
  return [...new Set(errors)];
}
