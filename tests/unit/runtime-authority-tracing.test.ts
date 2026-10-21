import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";
import nextConfig from "@/next.config";

const root = path.resolve(__dirname, "../..");

test("every server route traces only the operator-issued runtime authority JSON files", () => {
  expect(nextConfig.outputFileTracingIncludes).toEqual({ "/**": ["./runtime-authority/*.json"] });
});

test("runtime authority files are ignored and never tracked", () => {
  const ignore = fs.readFileSync(path.join(root, "runtime-authority/.gitignore"), "utf8").split(/\r?\n/);
  expect(ignore).toContain("*.json");
  const tracked = execFileSync("git", ["ls-files", "runtime-authority"], { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean).sort();
  expect(tracked).toEqual(["runtime-authority/.gitignore", "runtime-authority/README.md"]);
});
