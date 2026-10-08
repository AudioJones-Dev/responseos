import { db } from "../lib/db/client";
import { assertRetentionPurgeAllowed, parseRetentionPurgeArgs } from "../lib/retention/purgePolicy";
import { runRetentionPurge, type RetentionPurgeReport } from "../lib/retention/runRetentionPurge";

function formatReport(report: RetentionPurgeReport): string {
  const heading = report.mode === "preview"
    ? `Retention purge PREVIEW at ${report.now.toISOString()} (no rows changed)`
    : `Retention purge APPLIED at ${report.now.toISOString()}`;
  const countHeading = report.mode === "preview" ? "Due" : "Changed";
  const rows = report.sweeps.map((sweep, index) => [
    String(index + 1),
    sweep.label,
    sweep.skipped ? "-" : `${sweep.count} ${sweep.unit}`,
    sweep.skipped
      ? `skipped: ${sweep.skipped}`
      : Object.entries(sweep.details).map(([key, value]) => `${key}=${value}`).join(", "),
  ]);
  const table = [["#", "Sweep", countHeading, "Details"], ...rows];
  const widths = [0, 1, 2].map((column) => Math.max(...table.map((row) => row[column].length)));
  const lines = table.map((row) =>
    row.map((cell, column) => (column < 3 ? cell.padEnd(widths[column]) : cell)).join("  ").trimEnd(),
  );
  lines.splice(1, 0, [...widths.map((width) => "-".repeat(width)), "-------"].join("  "));
  return [heading, "", ...lines].join("\n");
}

async function main() {
  const mode = parseRetentionPurgeArgs(process.argv.slice(2));
  const scope = assertRetentionPurgeAllowed(mode, process.env);
  const report = await runRetentionPurge({ mode, ...scope });
  console.log(formatReport(report));
  if (report.failure) {
    throw new Error(`Sweep ${report.failure.key} failed (${report.failure.code}): ${report.failure.message}`);
  }
  console.log(
    mode === "preview"
      ? "\nPreview only. To apply, set RESPONSEOS_RETENTION_PURGE_ENABLED=true and run: npm run retention:purge -- --apply"
      : "\nEach change above is recorded in AuditLog.",
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Retention purge failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await db?.$disconnect();
  });
