import { createRequire } from "node:module";
import { describe, expect, test } from "vitest";

const rootRequire = createRequire(import.meta.url);

describe("ESLint plugin minimatch compatibility", () => {
  test.each([
    "eslint-plugin-import",
    "eslint-plugin-jsx-a11y",
    "eslint-plugin-react",
  ])("%s resolves a callable minimatch API", (plugin) => {
    const pluginRequire = createRequire(
      rootRequire.resolve(`${plugin}/package.json`),
    );
    const minimatch = pluginRequire("minimatch") as (
      value: string,
      pattern: string,
    ) => boolean;

    expect(typeof minimatch).toBe("function");
    expect(minimatch("Button", "*")).toBe(true);
  });
});
