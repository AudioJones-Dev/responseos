import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ACTION_RUNTIME_WORKFLOWS = new Set(["dashboard.yml"]);
const REQUIRED_APPLICATION_WORKFLOWS = new Set(["ci.yml", "deploy-staging.yml"]);

function npmVersion() {
  const fromAgent = process.env.npm_config_user_agent?.match(/\bnpm\/([^\s]+)/)?.[1];
  if (fromAgent) return fromAgent;
  return execFileSync(process.platform === "win32" ? "npm.cmd" : "npm", ["--version"], {
    encoding: "utf8",
    shell: process.platform === "win32",
  }).trim();
}

function workflowNodeVersions(root) {
  const workflowRoot = path.join(root, ".github", "workflows");
  const versions = [];
  const missing = [];
  const workflowNames = readdirSync(workflowRoot);
  for (const name of REQUIRED_APPLICATION_WORKFLOWS) {
    if (!workflowNames.includes(name)) {
      missing.push(`.github/workflows/${name}: required application workflow is missing`);
    }
  }
  for (const name of workflowNames) {
    if (ACTION_RUNTIME_WORKFLOWS.has(name) || !/\.ya?ml$/.test(name)) continue;
    const contents = readFileSync(path.join(workflowRoot, name), "utf8");
    const matches = [...contents.matchAll(/^\s*node-version:\s*["']?([^\s"'#]+)["']?/gm)];
    if (REQUIRED_APPLICATION_WORKFLOWS.has(name) && matches.length === 0) {
      missing.push(`.github/workflows/${name}: expected at least one node-version declaration`);
    }
    for (const match of matches) {
      versions.push({ source: `.github/workflows/${name}`, version: match[1] });
    }
  }
  return { missing, versions };
}

export function checkRuntimeConsistency(root = process.cwd()) {
  const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  const expectedNode = packageJson.volta?.node;
  const expectedNpm = packageJson.volta?.npm;
  const workflows = workflowNodeVersions(root);
  const declarations = [
    ["package.json engines.node", packageJson.engines?.node, expectedNode],
    ["package.json engines.npm", packageJson.engines?.npm, expectedNpm],
    ["package.json packageManager", packageJson.packageManager, `npm@${expectedNpm}`],
    [".nvmrc", readFileSync(path.join(root, ".nvmrc"), "utf8").trim(), expectedNode],
    ["active Node runtime", process.version.replace(/^v/, ""), expectedNode],
    ["active npm runtime", npmVersion(), expectedNpm],
    ...workflows.versions.map(({ source, version }) => [source, version, expectedNode]),
  ];
  const errors = [...workflows.missing];
  if (!expectedNode) errors.push("package.json volta.node is required");
  if (!expectedNpm) errors.push("package.json volta.npm is required");
  for (const [source, actual, expected] of declarations) {
    if (actual !== expected) errors.push(`${source}: expected ${expected}, found ${actual ?? "missing"}`);
  }
  return { errors, node: expectedNode, npm: expectedNpm };
}

function parseRoot(argv) {
  const index = argv.indexOf("--root");
  return index === -1 ? process.cwd() : path.resolve(argv[index + 1]);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const result = checkRuntimeConsistency(parseRoot(process.argv.slice(2)));
  if (result.errors.length) {
    console.error(["Runtime consistency check failed:", ...result.errors.map((error) => `- ${error}`)].join("\n"));
    process.exitCode = 1;
  } else {
    console.log(`Runtime consistency check passed: Node ${result.node} / npm ${result.npm}`);
  }
}
