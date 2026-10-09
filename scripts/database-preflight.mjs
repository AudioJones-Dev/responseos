import fs from "node:fs";
import { validateDatabaseConnections } from "./database-contract.mjs";

const [manifest, mode = "application", ...extra] = process.argv.slice(2);
let errors;
try {
  errors = extra.length ? ["unexpected_arguments"] : validateDatabaseConnections(process.env, JSON.parse(fs.readFileSync(manifest, "utf8")), mode);
} catch {
  errors = ["target_manifest_unreadable"];
}
if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ ok: true, scope: "configuration_only", databaseReadiness: "NOT_TESTED" }));
}
