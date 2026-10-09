import fs from "node:fs";
import { validateDatabaseConnections } from "./database-contract.mjs";

let client;
try {
  if (process.argv.length !== 3) throw new Error();
  const target = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  const errors = validateDatabaseConnections(process.env, target, "worker");
  if (errors.length) {
    console.error(JSON.stringify({ok:false,errors}));
    process.exitCode = 1;
  } else {
    const { PrismaClient } = await import("@prisma/client");
    client = new PrismaClient({log:[]});
    const [row] = await client.$queryRaw`SELECT current_database() AS database, current_user AS role, current_setting('server_version_num')::int / 10000 AS major, r.rolsuper OR r.rolbypassrls OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication OR EXISTS (SELECT 1 FROM pg_roles elevated WHERE elevated.rolname IN ('neondb_owner','neon_superuser','neon_service','cloud_admin') AND pg_has_role(current_user,elevated.oid,'MEMBER')) AS elevated, EXISTS (SELECT 1 FROM pg_class WHERE relnamespace='public'::regnamespace AND relowner=r.oid AND relkind='r') AS owns_tables FROM pg_roles r WHERE r.rolname=current_user`;
    const ready = row && row.database === target.database && row.role === target.runtimeRole && [17,18].includes(row.major) && !row.elevated && !row.owns_tables;
    console.log(JSON.stringify({ok:!!ready,scope:"connectivity_and_runtime_principal_only",schemaAndApplicationAcceptance:"NOT_TESTED"}));
    if (!ready) process.exitCode=1;
  }
} catch {
  console.error(JSON.stringify({ok:false,errors:["database_readiness_failed"]}));
  process.exitCode=1;
} finally {
  if (client) await client.$disconnect().catch(()=>{});
}
