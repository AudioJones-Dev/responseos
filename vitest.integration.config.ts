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
    exclude: ["tests/e2e/**", "node_modules/**"],
    fileParallelism: false,
    coverage: {
      provider: "v8",
      include: ["lib/auth/**", "lib/data/**", "lib/db/**"],
      reporter: ["text", "lcov"],
    },
  },
});
