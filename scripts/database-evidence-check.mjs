import fs from "node:fs";
import { migrationFiles, validateMigrationHistory, validateRestoreBindings } from "./database-contract.mjs";

const [mode, ...files] = process.argv.slice(2);
let errors;
try {
  const read = file => JSON.parse(fs.readFileSync(file, "utf8"));
  if (mode === "history" && files.length === 1) {
    const input = read(files[0]);
    if (!Array.isArray(input.migrations)) throw new Error();
    errors = validateMigrationHistory(input.migrations, migrationFiles("prisma/migrations"));
  } else if (mode === "restore" && files.length === 3) {
    errors = validateRestoreBindings(...files.map(read));
  } else errors=["invalid_arguments"];
} catch {
  errors=["evidence_unreadable_or_invalid"];
}
console[errors.length ? "error" : "log"](JSON.stringify({ok:errors.length===0,scope:"offline_evidence_only",errors}));
if (errors.length) process.exitCode=1;
