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
    include: ["tests/integration/**/*.test.ts"],
    exclude: ["tests/unit/**", "tests/e2e/**", "node_modules/**"],
    hookTimeout: 30_000,
    testTimeout: 15_000,
    fileParallelism: false,
    maxWorkers: 1,
    coverage: {
      provider: "v8",
      include: ["lib/auth/**", "lib/data/**", "lib/db/**", "lib/validation/**"],
      reporter: ["text", "lcov"],
    },
  },
});
