import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { pinnedCli, TOOLCHAIN } from "./qualification-tooling.mjs";

// Pipe input keeps the token out of OS argv, inherited environment, files and shell expansion.
try {
  if (process.version !== TOOLCHAIN.node) throw new Error("runtime_version_mismatch");
  const cli = pinnedCli(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));
  const token = fs.readFileSync(0, "utf8");
  if (!token || /\s/.test(token) || process.argv.slice(2).some(arg => /^(--token|-t|--debug)(=|$)/.test(arg))) throw new Error("invalid_cli_input");
  delete process.env.VERCEL_TOKEN;
  process.argv = [process.execPath, cli, ...process.argv.slice(2), "--token", token];
  await import(pathToFileURL(cli).href);
} catch {
  console.error("Pinned CLI stopped; values withheld.");
  process.exitCode = 1;
}
