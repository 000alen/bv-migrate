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
    testTimeout: 180_000,
    hookTimeout: 180_000,
    pool: "forks",
    poolOptions: {
      forks: { singleFork: true }, // sequential — avoid Circle rate limits
    },
  },
});
