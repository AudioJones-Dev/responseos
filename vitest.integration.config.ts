import path from "node:path";
import { defineConfig } from "vitest/config";

const integrationTestConfig = {
  globals: true,
  environment: "node" as const,
  include: ["tests/integration/**/*.test.ts"],
  exclude: ["tests/e2e/**", "node_modules/**"],
  pool: "forks" as const,
  singleFork: true,
  fileParallelism: false,
  testTimeout: 60_000,
};

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: integrationTestConfig,
});
