import fs from "node:fs";
import { runtimePrincipalQuery } from "./database-principal-query.mjs";
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
    const [row] = await client.$queryRawUnsafe(runtimePrincipalQuery);
    const ready = row && row.database === target.database && row.role === target.runtimeRole && row.login === row.role && [17,18].includes(row.major) && !row.elevated && !row.owns_tables;
    console.log(JSON.stringify({ok:!!ready,scope:"connectivity_and_runtime_principal_only",schemaAndApplicationAcceptance:"NOT_TESTED"}));
    if (!ready) process.exitCode=1;
  }
} catch {
  console.error(JSON.stringify({ok:false,errors:["database_readiness_failed"]}));
  process.exitCode=1;
} finally {
  if (client) await client.$disconnect().catch(()=>{});
}
