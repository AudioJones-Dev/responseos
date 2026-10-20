import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { TOOLCHAIN, requireToolingInstallation, lockedTools, verifyToolArchive, pinnedNpm, pinnedCli } from "./qualification-tooling.mjs";
const control = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
try {
  requireToolingInstallation(JSON.parse(fs.readFileSync(path.join(control, "infra/qualification-deployment.json"), "utf8")));
  if (process.platform !== "linux" || process.version !== TOOLCHAIN.node) throw new Error("pinned_linux_runner_required");
  const { directory, lock } = lockedTools(control);
  const target = path.join(control, ".qualification-tools");
  if (fs.existsSync(target)) throw new Error("fresh_tool_directory_required");
  fs.mkdirSync(target, { mode: 0o700 });
  const bootstrap = fs.mkdtempSync(path.join(target, "bootstrap-"));
  const env = { PATH: `${path.dirname(process.execPath)}:/usr/bin:/bin`, HOME: bootstrap, NPM_CONFIG_USERCONFIG: path.join(bootstrap, "empty.npmrc"), NPM_CONFIG_GLOBALCONFIG: path.join(bootstrap, "global.npmrc"), NPM_CONFIG_CACHE: path.join(bootstrap, "cache") };
  fs.writeFileSync(env.NPM_CONFIG_USERCONFIG, "");
  fs.writeFileSync(env.NPM_CONFIG_GLOBALCONFIG, "");
  function command(bin, args) {
    const result = spawnSync(bin, args, { cwd: bootstrap, env, encoding: "utf8", maxBuffer: 8 * 1024 * 1024, timeout: 20 * 60_000 });
    if (result.status !== 0) throw new Error("tool_preparation_failed");
    return result.stdout.trim();
  }
  const artifact = lock.packages["node_modules/npm"];
  const response = await fetch(artifact.resolved, { redirect: "error", signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error("bootstrap_download_failed");
  const archive = Buffer.from(await response.arrayBuffer());
  verifyToolArchive(archive, artifact.integrity);
  const archivePath = path.join(bootstrap, "npm.tgz");
  fs.writeFileSync(archivePath, archive, { mode: 0o600 });
  command("/usr/bin/tar", ["-xzf", archivePath, "--no-same-owner", "--no-same-permissions", "-C", bootstrap]);
  const npm = path.join(bootstrap, "package/bin/npm-cli.js");
  if (command(process.execPath, [npm, "--version"]) !== TOOLCHAIN.npm) throw new Error("npm_version_mismatch");
  for (const file of ["package.json", "package-lock.json"]) fs.copyFileSync(path.join(directory, file), path.join(target, file));
  command(process.execPath, [npm, "ci", "--prefix", target, "--ignore-scripts", "--no-audit", "--no-fund", "--registry=https://registry.npmjs.org"]);
  if (command(process.execPath, [pinnedNpm(control), "--version"]) !== TOOLCHAIN.npm) throw new Error("npm_version_mismatch");
  pinnedCli(control);
  console.log("Locked qualification tooling prepared and verified.");
} catch { console.error("Tooling preparation stopped; values withheld."); process.exitCode = 1; }
