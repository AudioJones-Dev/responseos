import { pinnedCli, pinnedNpm, validateToolchain } from "./qualification-tooling.mjs";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";
import { LIVE_DEMO_TARGET as target } from "./live-demo-commissioning-contract.mjs";
import { runQualificationDeployment, validateQualificationDispatch } from "./qualification-deployment.mjs";

const control = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const application = path.resolve(process.argv[2] ?? "application");
const policy = JSON.parse(fs.readFileSync(path.join(control, "infra/qualification-deployment.json"), "utf8"));
const safeEnv = Object.fromEntries(["PATH", "HOME", "TMPDIR", "SystemRoot", "TEMP", "TMP"].filter(k => process.env[k]).map(k => [k, process.env[k]]));
safeEnv.NEXT_TELEMETRY_DISABLED = "1";
function command(bin, args, cwd, env = safeEnv, input) {
  const result = spawnSync(bin, args, { cwd, env, input, encoding: "utf8", maxBuffer: 8 * 1024 * 1024, timeout: 20 * 60_000 });
  if (result.status !== 0) throw new Error("command_failed_values_withheld");
  return result.stdout.trim();
}
function revisions() {
  return {
    controlSha: process.env.CONTROL_SHA, workflowSha: process.env.WORKFLOW_SHA,
    applicationSha: process.env.APPLICATION_SHA, ref: process.env.CONTROL_REF,
    controlHead: command("git", ["rev-parse", "HEAD"], control),
    controlTip: command("git", ["ls-remote", "https://github.com/AudioJones-Dev/responseos.git", policy.trustedControlRef], control).split(/\s+/)[0],
    applicationHead: command("git", ["rev-parse", "HEAD"], application),
  };
}
async function json(url, headers) {
  const response = await fetch(url, { headers, redirect: "error", signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error("readback_failed_values_withheld");
  return response.json();
}
try {
  // This guard precedes remote revision resolution and all credential use.
  if (policy.enabled !== true) throw new Error("qualification_deployment_not_authorized");
  if (control === application) throw new Error("separate_checkouts_required");
  const input = revisions();
  const errors = validateQualificationDispatch(input, policy);
  if (errors.length) throw new Error("revision_or_approval_invalid");
  if (process.argv.includes("--gate-only")) {
    console.log("Reviewed qualification dispatch gate passed.");
  } else {
    const npm = pinnedNpm(control);
    if (process.version !== "v24.18.0" || command(process.execPath, [npm, "--version"], application) !== "11.16.0") throw new Error("runtime_version_mismatch");
    const cli = pinnedCli(control);
    const versions = { node: process.version, npm: command(process.execPath, [npm, "--version"], application), vercel: command(process.execPath, [cli, "--version"], application) };
    if (validateToolchain(versions).length) throw new Error("toolchain_version_mismatch");
    const env = process.env;
    const cliEnv = { ...safeEnv, PATH: path.join(control, ".qualification-tools/node_modules/.bin") + path.delimiter + safeEnv.PATH, VERCEL_ORG_ID: env.VERCEL_ORG_ID, VERCEL_PROJECT_ID: env.VERCEL_PROJECT_ID };
    const result = await runQualificationDeployment(input, policy, env, {
      toolVersions: () => versions,
      cliVersion: () => versions.vercel,
      get: resource => {
        const url = new URL(resource, "https://api.vercel.com");
        url.searchParams.set("teamId", target.orgId);
        return json(url, { Authorization: `Bearer ${env.VERCEL_TOKEN}` });
      },
      cli: (args, extra = {}) => command(process.execPath, [path.join(control, "scripts/qualification-cli.mjs"), ...args], application, { ...cliEnv, ...extra }, env.VERCEL_TOKEN),
      readPulledEnvironment: slug => parseEnv(fs.readFileSync(path.join(application, `.vercel/.env.${slug}.local`), "utf8")),
      readProjectLink: () => JSON.parse(fs.readFileSync(path.join(application, ".vercel/project.json"), "utf8")),
      prepareApplication: () => {
        command(process.execPath, [pinnedNpm(control), "ci", "--ignore-scripts", "--no-audit", "--no-fund"], application);
        command(process.execPath, ["scripts/patch-minimatch-cjs-compat.mjs"], application);
        command(process.execPath, ["node_modules/prisma/build/index.js", "generate"], application);
      },
      readBuildTarget: () => JSON.parse(fs.readFileSync(path.join(application, ".vercel/output/builds.json"), "utf8")).target,
      assertCleanSource: () => {
        if (command("git", ["status", "--porcelain", "--untracked-files=no"], application)) throw new Error("application_source_changed");
        const config = JSON.parse(fs.readFileSync(path.join(application, "vercel.json"), "utf8"));
        if (Object.keys(config).some(k => !["$schema", "git"].includes(k)) || JSON.stringify(config.git) !== '{"deploymentEnabled":false}') throw new Error("unapproved_application_build_settings");
        const linked = JSON.parse(fs.readFileSync(path.join(application, ".vercel/project.json"), "utf8"));
        const settings = linked.settings;
        if (settings?.framework !== "nextjs" || settings?.rootDirectory !== null || settings?.outputDirectory !== null || settings?.installCommand !== "npm --version" || settings?.buildCommand !== "npm run build") throw new Error("unapproved_local_build_settings");
      },
      revisions,
      health: origin => json(`${origin}/api/health`, { "x-vercel-protection-bypass": env.VERCEL_AUTOMATION_BYPASS_SECRET }),
    });
    console.log(JSON.stringify(result));
  }
} catch {
  console.error("Qualification deployment stopped; input, command and provider values withheld. A deployment or alias change may already exist. No automatic retry or rollback is performed.");
  process.exitCode = 1;
}
