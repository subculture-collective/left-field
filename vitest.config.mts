import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    exclude: [...configDefaults.exclude, "tests/e2e/**"],
    globals: true,
    maxWorkers: 2,
    setupFiles: ["./src/test/setup.ts"],
    // Many tests rebuild retained artifacts from raw sources and compare; 5 s is too tight under parallel load.
    testTimeout: 60_000,
  },
});
