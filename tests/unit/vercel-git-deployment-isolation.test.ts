import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

describe("Vercel Git deployment isolation", () => {
  test("disables automatic deployments for every Git branch", () => {
    const configuration = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "vercel.json"), "utf8"),
    ) as { git?: { deploymentEnabled?: unknown } };

    expect(configuration.git?.deploymentEnabled).toBe(false);
    expect(typeof configuration.git?.deploymentEnabled).toBe("boolean");
  });
});
