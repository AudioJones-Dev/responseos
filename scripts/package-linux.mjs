import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

const root = process.cwd();
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  if (result.status !== 0) throw Error(`Packaging step failed: ${command}`);
  return result.stdout?.trim();
}
if (process.platform !== "linux" || process.version !== "v24.18.0") throw Error("Requires Linux Node 24.18.0");
if (run("npm", ["--version"]) !== "11.16.0") throw Error("Requires npm 11.16.0");
if (run("git", ["status", "--porcelain"])) throw Error("Requires clean committed source");
if (fs.readdirSync(root).some(file => /^\.env(?:\.|$)/.test(file) && file !== ".env.example")) {
  throw Error("Packaging checkout must not contain environment files");
}
const sha = run("git", ["rev-parse", "HEAD"]);
const destination = path.resolve(process.argv[2] ?? "");
if (!process.argv[2] || destination === root || destination.startsWith(root + path.sep) || fs.existsSync(destination)) {
  throw Error("Requires a new output directory outside the checkout");
}
const qualification = JSON.parse(fs.readFileSync("infra/grok-qualification.json", "utf8"));
if (qualification.enabled !== false) throw Error("Packaging requires inactive qualification");
const env = {
  PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR,
  NODE_ENV: "production", NODE_OPTIONS: "--max-old-space-size=2048",
  NEXT_TELEMETRY_DISABLED: "1", DO_NOT_TRACK: "1", CHECKPOINT_DISABLE: "1",
  PRISMA_QUERY_ENGINE_LIBRARY: process.env.PRISMA_QUERY_ENGINE_LIBRARY,
  PRISMA_SCHEMA_ENGINE_BINARY: process.env.PRISMA_SCHEMA_ENGINE_BINARY,
  RESPONSEOS_BUILD_SHA: sha, RESPONSEOS_REQUIRE_AUTH: "true",
  RESPONSEOS_QUALIFICATION_ACTIVATION: "DISABLED", RESPONSEOS_GROK_WATCHDOG_MODE: "inactive",
  RESPONSEOS_GROK_WATCHDOG_ENABLED: "false",
};
run(process.execPath, ["node_modules/next/dist/bin/next", "build"], { env, stdio: "inherit" });
fs.mkdirSync(destination);
const runtime = path.join(destination, "runtime");
fs.mkdirSync(runtime);
const files = run("git", ["ls-files", "-z"]).split("\0").filter(Boolean).filter(file =>
  /^(app|lib|prisma|public|types)\//.test(file) ||
  /^scripts\/(grok-[^/]+\.(ts|mjs)|run-linux-package\.mjs)$/.test(file) ||
  /^(package(-lock)?\.json|tsconfig\.json|next\.config\.ts|next-env\.d\.ts|proxy\.ts|middleware\.ts|postcss\.config\.mjs)$/.test(file) ||
  file === "infra/grok-qualification.json"
);
for (const file of files) {
  fs.mkdirSync(path.dirname(path.join(runtime, file)), { recursive: true });
  fs.copyFileSync(file, path.join(runtime, file));
}
for (const directory of ["node_modules", ".next"]) {
  fs.cpSync(directory, path.join(runtime, directory), {
    recursive: true, verbatimSymlinks: true,
    filter: source => !source.startsWith(".next/cache") && !/(^|\/)\.env(?:\.|$)/.test(source),
  });
}
const manifest = [];
function inventory(directory) {
  for (const item of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = path.join(directory, item.name), relative = path.relative(runtime, absolute);
    if (item.isDirectory()) inventory(absolute);
    else if (item.isSymbolicLink()) {
      const link = fs.readlinkSync(absolute), resolved = path.resolve(path.dirname(absolute), link);
      if (path.isAbsolute(link) || !resolved.startsWith(runtime + path.sep)) throw Error("External package symlink");
      manifest.push({ path: relative, link });
    } else {
      manifest.push({ path: relative, sha256: createHash("sha256").update(fs.readFileSync(absolute)).digest("hex") });
    }
  }
}
inventory(runtime);
fs.writeFileSync(path.join(runtime, "PACKAGE.json"), JSON.stringify({
  applicationSha: sha, tree: run("git", ["rev-parse", "HEAD^{tree}"]),
  platform: process.platform, architecture: process.arch, node: process.version, npm: "11.16.0",
  activation: false, database: false, providers: false,
  defaultCommand: "node scripts/run-linux-package.mjs",
  files: manifest,
}, null, 2) + "\n");
const archive = path.join(destination, `responseos-${sha}-linux-${process.arch}.tar.gz`);
run("tar", ["--sort=name", "--mtime=@0", "--owner=0", "--group=0", "--numeric-owner",
  "-czf", archive, "-C", destination, "runtime"]);
const digest = createHash("sha256").update(fs.readFileSync(archive)).digest("hex");
fs.writeFileSync(path.join(destination, "SHA256SUMS.txt"), `${digest}  ${path.basename(archive)}\n`);
console.info(`Local inactive Linux package: ${path.basename(archive)} sha256 ${digest}`);
