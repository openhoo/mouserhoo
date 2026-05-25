import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/generated/**", "src/index.ts", "src/types.ts"],
      thresholds: {
        branches: 85,
        functions: 95,
        lines: 92,
        statements: 92,
      },
    },
  },
});
