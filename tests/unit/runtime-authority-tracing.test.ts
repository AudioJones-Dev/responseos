import fs from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";
import nextConfig from "@/next.config";

const root = path.resolve(__dirname, "../..");

test("every server route traces only the operator-issued runtime authority JSON files", () => {
  expect(nextConfig.outputFileTracingIncludes).toEqual({ "/**": ["./runtime-authority/*.json"] });
});

test("runtime authority files are never committed", () => {
  const ignore = fs.readFileSync(path.join(root, "runtime-authority/.gitignore"), "utf8").split(/\r?\n/);
  expect(ignore).toContain("*.json");
  const tracked = fs.readdirSync(path.join(root, "runtime-authority"));
  expect(tracked.filter(name => name.endsWith(".json"))).toEqual([]);
});
