import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, test } from "vitest";

const repoRoot = process.cwd();
const syncScript = path.join(repoRoot, "scripts", "sync-dashboard.mjs");
const fetchMock = pathToFileURL(
  path.join(repoRoot, "tests", "fixtures", "mock-github-fetch.mjs"),
).href;

function runSync(cwd: string, response: unknown): void {
  execFileSync(process.execPath, ["--import", fetchMock, syncScript], {
    cwd,
    env: {
      ...process.env,
      GITHUB_REPOSITORY: "AudioJones-Dev/responseos",
      GITHUB_TOKEN: "test-token",
      MOCK_GITHUB_RESPONSE: JSON.stringify(response),
    },
    stdio: "pipe",
  });
}

describe("dashboard sync script", () => {
  test("leaves dashboard data untouched when only generatedAt would change", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "responseos-dashboard-sync-"));
    const dataPath = path.join(cwd, "dashboard", "dashboard-data.json");
    const original = {
      generatedAt: "2026-07-27T00:00:00.000Z",
      tasks: [],
      liveIssues: [],
    };
    const serialized = `${JSON.stringify(original, null, 2)}\n`;

    try {
      mkdirSync(path.dirname(dataPath), { recursive: true });
      writeFileSync(dataPath, serialized);

      runSync(cwd, []);

      expect(readFileSync(dataPath, "utf8")).toBe(serialized);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test("writes dashboard data and advances generatedAt after a substantive change", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "responseos-dashboard-sync-"));
    const dataPath = path.join(cwd, "dashboard", "dashboard-data.json");
    const original = {
      generatedAt: "2026-07-27T00:00:00.000Z",
      tasks: [],
      liveIssues: [],
    };

    try {
      mkdirSync(path.dirname(dataPath), { recursive: true });
      writeFileSync(dataPath, `${JSON.stringify(original, null, 2)}\n`);

      runSync(cwd, [
        {
          number: 100,
          title: "Contain automatic deployments",
          html_url: "https://github.com/AudioJones-Dev/responseos/issues/100",
          state: "open",
          labels: [{ name: "p0" }],
        },
      ]);

      const updated = JSON.parse(readFileSync(dataPath, "utf8"));
      expect(updated.generatedAt).not.toBe(original.generatedAt);
      expect(updated.liveIssues).toEqual([
        {
          number: 100,
          title: "Contain automatic deployments",
          url: "https://github.com/AudioJones-Dev/responseos/issues/100",
          state: "open",
          labels: ["p0"],
        },
      ]);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
