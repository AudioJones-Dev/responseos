import fs from "node:fs";
import path from "node:path";
import { createHash, timingSafeEqual } from "node:crypto";
export const TOOLCHAIN = Object.freeze({ node: "v24.18.0", npm: "11.16.0", vercel: "41.7.0" });
export function validateToolchain(versions) {
  return Object.keys(TOOLCHAIN).filter(key => versions?.[key] !== TOOLCHAIN[key]).map(key => `${key}_version_mismatch`);
}
export function requireToolingInstallation(policy) {
  if (policy?.enabled !== true || policy.toolingInstallationApproved !== true || !policy.approvalReference?.trim()) throw new Error("tooling_installation_not_authorized");
}
export function lockedTools(control) {
  const directory = path.join(control, "infra/qualification-toolchain");
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, "integrity.json"), "utf8"));
  const lockBytes = fs.readFileSync(path.join(directory, "package-lock.json"));
  const packageBytes = fs.readFileSync(path.join(directory, "package.json"));
  const hash = bytes => createHash("sha256").update(bytes).digest("hex");
  if (hash(lockBytes) !== manifest.lockSha256 || hash(packageBytes) !== manifest.packageSha256) throw new Error("tool_lock_integrity_mismatch");
  const lock = JSON.parse(lockBytes);
  const pkg = JSON.parse(packageBytes);
  if (lock.lockfileVersion !== 3 || JSON.stringify(pkg.dependencies) !== JSON.stringify({ npm: TOOLCHAIN.npm, vercel: TOOLCHAIN.vercel }) || JSON.stringify(lock.packages?.[""]?.dependencies) !== JSON.stringify(pkg.dependencies)) throw new Error("tool_lock_contract_mismatch");
  for (const [name, item] of Object.entries(lock.packages)) {
    if (!name) continue;
    if (name.split("/").includes("..") || !name.startsWith("node_modules/") || item.link) throw new Error("unsafe_tool_lock_entry");
    if (item.inBundle && name.startsWith("node_modules/npm/node_modules/")) continue;
    if (typeof item.resolved !== "string" || !item.resolved.startsWith("https://registry.npmjs.org/") || !/^sha512-[A-Za-z0-9+/]{86}==$/.test(item.integrity ?? "")) throw new Error("tool_dependency_integrity_missing");
  }
  for (const name of ["npm", "vercel"]) if (lock.packages[`node_modules/${name}`]?.version !== TOOLCHAIN[name]) throw new Error("tool_lock_version_mismatch");
  return { directory, manifest, lock };
}
export function verifyToolArchive(bytes, integrity) {
  if (!/^sha512-[A-Za-z0-9+/]{86}==$/.test(integrity ?? "")) throw new Error("tool_archive_integrity_invalid");
  if (!timingSafeEqual(createHash("sha512").update(bytes).digest(), Buffer.from(integrity.slice(7), "base64"))) throw new Error("tool_archive_integrity_mismatch");
}
export function verifyInstalledTools(control) {
  const { manifest } = lockedTools(control);
  const root = path.join(control, ".qualification-tools");
  const required = ["node_modules/npm/package.json", "node_modules/npm/bin/npm-cli.js", "node_modules/vercel/package.json", "node_modules/vercel/dist/index.js"];
  if (Object.keys(manifest.entrypoints).sort().join() !== required.sort().join()) throw new Error("tool_entrypoint_manifest_invalid");
  for (const entry of required) {
    const actual = createHash("sha256").update(fs.readFileSync(path.join(root, entry))).digest("hex");
    if (actual !== manifest.entrypoints[entry]) throw new Error("tool_entrypoint_integrity_mismatch");
  }
  if (!fs.readFileSync(path.join(root, "package-lock.json")).equals(fs.readFileSync(path.join(control, "infra/qualification-toolchain/package-lock.json")))) throw new Error("installed_tool_lock_mismatch");
}
export function pinnedCli(control) {
  verifyInstalledTools(control);
  return path.join(control, ".qualification-tools/node_modules/vercel/dist/index.js");
}
export function pinnedNpm(control) {
  verifyInstalledTools(control);
  return path.join(control, ".qualification-tools/node_modules/npm/bin/npm-cli.js");
}
