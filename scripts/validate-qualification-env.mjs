import fs from "node:fs";
import { parseEnv } from "node:util";
import { validateQualificationPreflight } from "./live-demo-commissioning-contract.mjs";

const [envPath, policyPath] = process.argv.slice(2);
if (!envPath || !policyPath) {
  console.error("Usage: node scripts/validate-qualification-env.mjs <env-file> <qualification-evidence.json>");
  process.exit(1);
}
try {
  const env = parseEnv(fs.readFileSync(envPath, "utf8"));
  const policy = JSON.parse(fs.readFileSync(policyPath, "utf8"));
  const errors = validateQualificationPreflight(env, policy);
  if (errors.length) {
    console.error(["Effects-disabled offline qualification preflight failed:", ...errors].join("\n"));
    process.exitCode = 1;
  } else {
    console.log("Effects-disabled offline qualification preflight passed; policy evidence is attested, unverified. Hosted identity, live carrier authorization and authenticated durable assignment verification remain separate gates.");
  }
} catch {
  console.error("Qualification input could not be read or parsed; values withheld.");
  process.exitCode = 1;
}
