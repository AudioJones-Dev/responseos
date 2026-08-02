import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const packageRequire = createRequire(import.meta.url);
let packagePath;

try {
  packagePath = packageRequire.resolve("minimatch/package.json");
} catch (error) {
  if (error?.code === "MODULE_NOT_FOUND") {
    process.exit(0);
  }

  throw error;
}

const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));

if (packageJson.version !== "10.2.5") {
  throw new Error(
    `Expected minimatch 10.2.5, received ${packageJson.version}. Review the CommonJS compatibility patch before upgrading.`,
  );
}

const entryPath = path.join(
  path.dirname(packagePath),
  "dist",
  "commonjs",
  "index.js",
);
const marker = "exports.minimatch.unescape = unescape_js_1.unescape;";
const compatibilityExport = [
  marker,
  "Object.assign(exports.minimatch, exports);",
  "module.exports = exports.minimatch;",
].join("\n");
const source = fs.readFileSync(entryPath, "utf8");

if (source.includes(compatibilityExport)) {
  process.exit(0);
}

if (!source.includes(marker)) {
  throw new Error(
    "The minimatch CommonJS entry point changed. Refusing to apply an unverified compatibility patch.",
  );
}

fs.writeFileSync(
  entryPath,
  source.replace(marker, compatibilityExport),
  "utf8",
);
