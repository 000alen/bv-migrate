import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    // Module 2 PDF extract + Circle import can exceed 3 minutes
    testTimeout: 600_000,
    hookTimeout: 60_000,
    fileParallelism: false, // sequential — avoid Circle rate limits
  },
});
