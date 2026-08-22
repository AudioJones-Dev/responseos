import fs from "node:fs";
import { pathToFileURL } from "node:url";

export function validatePrismaMigrationStatus(exitCode, output) {
  if (exitCode === 0) {
    return { status: "current", errors: [] };
  }

  if (
    exitCode === 1 &&
    output.includes("have not yet been applied") &&
    !/failed/i.test(output)
  ) {
    return { status: "pending", errors: [] };
  }

  return {
    status: "unsafe",
    errors: [
      "Prisma migration status preflight failed or reported an unsafe state.",
    ],
  };
}

function main() {
  const [statusPath, rawExitCode] = process.argv.slice(2);
  const exitCode = Number(rawExitCode);

  if (!statusPath || !Number.isInteger(exitCode) || exitCode < 0) {
    console.error(
      "Usage: node validate-prisma-migration-status.mjs <status-file> <exit-code>",
    );
    process.exit(1);
  }

  const result = validatePrismaMigrationStatus(
    exitCode,
    fs.readFileSync(statusPath, "utf8"),
  );

  if (result.errors.length > 0) {
    for (const error of result.errors) console.error(`::error::${error}`);
    process.exit(1);
  }

  if (result.status === "current") {
    console.log("Prisma migration status is current.");
  } else {
    console.log(
      "Prisma reports pending migrations; migrate deploy remains the only authorized mutation.",
    );
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
