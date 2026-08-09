import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    globals: true,
    environment: "node",
    // Two suites exceed the 5s default on slower local machines; CI on
    // Node 20 passes either way (release-hygiene note, checkpoint 2026-07-04).
    testTimeout: 20_000,
    include: ["tests/unit/**/*.test.ts"],
    exclude: ["tests/integration/**", "tests/e2e/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      include: ["lib/auth/**", "lib/data/**", "lib/db/**", "lib/validation/**"],
      reporter: ["text", "lcov"],
    },
  },
});
