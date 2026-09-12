import { pathToFileURL } from "node:url";
import {
  readJson,
  validateEnvironmentContract,
  validateRepositoryContracts,
} from "./environment-contract.mjs";

export function validateEnvironment(environment, secretContract) {
  return validateEnvironmentContract(environment, secretContract);
}

const invokedPath = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : undefined;

if (invokedPath === import.meta.url) {
  const args = process.argv.slice(2);
  try {
    const errors =
      args[0] === "--repository"
        ? validateRepositoryContracts()
        : validateEnvironmentContract(
            readJson(args[0]),
            args[1] ? readJson(args[1]) : undefined,
          );

    if (errors.length > 0) {
      console.error(["Environment contract validation failed:", ...errors].join("\n"));
      process.exit(1);
    }
    console.log(
      args[0] === "--repository"
        ? "ResponseOS Environment Contract v1 repository artifacts are valid."
        : "ResponseOS Environment Contract v1 validation passed.",
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Environment validation failed");
    process.exit(1);
  }
}
