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
  const control = JSON.parse(fs.readFileSync(new URL("../infra/qualification-deployment.json", import.meta.url), "utf8"));
  const policy = JSON.parse(fs.readFileSync(policyPath, "utf8"));
  const errors = validateQualificationPreflight(env, policy, control.qualificationMode);
  if (errors.length) {
    console.error(["Trusted-mode qualification preflight failed:", ...errors].join("\n"));
    process.exitCode = 1;
  } else {
    console.log("Trusted-mode qualification preflight passed; policy evidence is attested, unverified. Hosted identity, live carrier authorization and authenticated durable assignment verification remain separate gates.");
  }
} catch {
  console.error("Qualification input could not be read or parsed; values withheld.");
  process.exitCode = 1;
}
